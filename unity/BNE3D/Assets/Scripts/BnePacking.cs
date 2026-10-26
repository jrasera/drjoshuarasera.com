using System;
using System.Collections.Generic;
using UnityEngine;

namespace Bne3D
{
    public struct BneGrainSpec { public Vector3 position; public float radius; public bool large; }

    public static class BnePacking
    {
        public static List<BneGrainSpec> Generate(BneSettings settings)
        {
            string error=settings.Validate(); if(error!=null)throw new ArgumentException(error);
            var random=new System.Random(settings.seed); var specs=new List<BneGrainSpec>();
            float maxR=0, minR=float.PositiveInfinity, volume=0;
            for(int i=0;i<settings.smallCount+settings.LargeCount;i++)
            {
                bool large=i>=settings.smallCount;
                float d=large ? (settings.singleIntruder?(settings.smallMin+settings.smallMax)*.5f*settings.intruderRatio:Mathf.Lerp(settings.largeMin,settings.largeMax,(float)random.NextDouble())) : Mathf.Lerp(settings.smallMin,settings.smallMax,(float)random.NextDouble());
                float r=d*.5f; specs.Add(new BneGrainSpec{radius=r,large=large});maxR=Mathf.Max(maxR,r);minR=Mathf.Min(minR,r);volume+=4f/3f*Mathf.PI*r*r*r;
            }
            float R=settings.diameter*.5f, area=Mathf.PI*R*R;
            if(maxR*2>=settings.diameter || volume>area*settings.height*.3f)throw new ArgumentException("The grains do not fit. Increase vial size or reduce particle size/count.");
            var groups=new List<List<BneGrainSpec>>();
            if(settings.layered){groups.Add(specs.FindAll(p=>p.large));groups.Add(specs.FindAll(p=>!p.large));}else groups.Add(specs);
            if(settings.compact)return Supported(groups,settings,random,maxR,minR);
            var placed=new List<BneGrainSpec>(); var grid=new Dictionary<Vector3Int,List<BneGrainSpec>>(); float cell=2*maxR, gap=minR*.025f, bottom=0;
            foreach(var group in groups)
            {
                // Place larger spheres first so small grains cannot obstruct their insertion.
                // Positions and sampled diameters remain seeded and stochastic.
                group.Sort((a,b)=>b.radius.CompareTo(a.radius));
                float groupVolume=0,groupR=0;
                foreach(var p in group){groupVolume+=4f/3f*Mathf.PI*p.radius*p.radius*p.radius;groupR=Mathf.Max(groupR,p.radius);}
                float depth=Mathf.Max(2*groupR+2*gap,groupVolume/(area*.15f));
                if(bottom+depth>settings.height)throw new ArgumentException("The suspended starting bed needs more height. Increase vial height; you can fit the camera to the bed after settling.");
                float top=bottom;
                foreach(var original in group)
                {
                    var p=original; bool accepted=false;
                    for(int attempt=0;attempt<8000&&!accepted;attempt++)
                    {
                        float angle=(float)random.NextDouble()*2*Mathf.PI,radial=Mathf.Sqrt((float)random.NextDouble())*(R-p.radius-gap);
                        p.position=new Vector3(radial*Mathf.Cos(angle),bottom+p.radius+gap+(float)random.NextDouble()*(depth-2*p.radius-2*gap),radial*Mathf.Sin(angle));
                        var key=Key(p.position,cell);bool hit=false;
                        for(int x=-1;x<=1&&!hit;x++)for(int y=-1;y<=1&&!hit;y++)for(int z=-1;z<=1&&!hit;z++)
                            if(grid.TryGetValue(key+new Vector3Int(x,y,z),out var near))foreach(var q in near)
                                if((p.position-q.position).sqrMagnitude<Mathf.Pow(p.radius+q.radius+gap,2)){hit=true;break;}
                        if(hit)continue;
                        if(!grid.TryGetValue(key,out var list)){list=new List<BneGrainSpec>();grid.Add(key,list);}list.Add(p);placed.Add(p);top=Mathf.Max(top,p.position.y+p.radius);accepted=true;
                    }
                    if(!accepted)throw new ArgumentException("Could not pack this starting bed. Increase vial size or reduce particle size/count.");
                }
                bottom=top+gap;
            }
            return placed;
        }
        // Seeded ballistic deposition: every sphere starts above a real supporting surface.
        // This changes initialization, not the subsequent collision laws.
        static List<BneGrainSpec> Supported(List<List<BneGrainSpec>> groups,BneSettings settings,System.Random random,float maxR,float minR)
        {
            var placed=new List<BneGrainSpec>();var grid=new Dictionary<Vector2Int,List<BneGrainSpec>>();
            float cell=2*maxR,gap=minR*.01f,bottom=0,R=settings.diameter*.5f;
            foreach(var group in groups)
            {
                for(int i=group.Count-1;i>0;i--){int j=random.Next(i+1);var a=group[i];group[i]=group[j];group[j]=a;}
                float top=bottom;
                foreach(var original in group)
                {
                    var best=original;float bestY=float.PositiveInfinity;
                    bool centred=settings.singleIntruder&&settings.layered&&original.large;
                    for(int candidate=0;candidate<(centred?1:16);candidate++)
                    {
                        float angle=(float)random.NextDouble()*2*Mathf.PI,radial=Mathf.Sqrt((float)random.NextDouble())*(R-original.radius-gap);
                        float x=centred?0:radial*Mathf.Cos(angle),z=centred?0:radial*Mathf.Sin(angle),y=bottom+original.radius+gap;
                        var key=new Vector2Int(Mathf.FloorToInt(x/cell),Mathf.FloorToInt(z/cell));
                        for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)
                            if(grid.TryGetValue(key+new Vector2Int(dx,dz),out var near))foreach(var q in near)
                            {
                                float separation=original.radius+q.radius+gap,dist=(x-q.position.x)*(x-q.position.x)+(z-q.position.z)*(z-q.position.z);
                                if(dist<separation*separation)y=Mathf.Max(y,q.position.y+Mathf.Sqrt(separation*separation-dist));
                            }
                        if(y<bestY){bestY=y;best.position=new Vector3(x,y,z);}
                    }
                    if(bestY+best.radius>=settings.height)throw new ArgumentException("This supported bed needs more vial height or fewer grains.");
                    var bestKey=new Vector2Int(Mathf.FloorToInt(best.position.x/cell),Mathf.FloorToInt(best.position.z/cell));
                    if(!grid.TryGetValue(bestKey,out var list)){list=new List<BneGrainSpec>();grid.Add(bestKey,list);}list.Add(best);placed.Add(best);top=Mathf.Max(top,bestY+best.radius);
                }
                bottom=top+gap;
            }
            return placed;
        }
        static Vector3Int Key(Vector3 p,float cell)=>new Vector3Int(Mathf.FloorToInt(p.x/cell),Mathf.FloorToInt(p.y/cell),Mathf.FloorToInt(p.z/cell));
    }
}
