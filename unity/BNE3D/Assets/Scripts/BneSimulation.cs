using System;
using System.Collections.Generic;
using UnityEngine;

namespace Bne3D
{
    public enum BnePhase { Empty, Settling, Ready, Shaking, Resting, Paused, Complete, Error }
    public sealed class BneSimulation : MonoBehaviour
    {
        public BneSettings Settings {get;private set;}
        public BnePhase Phase {get;private set;}=BnePhase.Empty;
        public string Error {get;private set;}="";
        public float ShakeTime {get;private set;}
        public float SettleTime {get;private set;}
        public float RestTime {get;private set;}
        public float Playback=1f;
        public float VialY=>vial==null?0:vial.position.y;
        public BneSample Initial {get;private set;}
        public readonly List<BnePoint> History=new List<BnePoint>();
        public event Action Prepared,Completed;
        public bool Cutaway,HideSmall;
        public int GrainCount=>grains.Count;
        public float ActualRate {get;private set;}
        public double PhysicsMilliseconds {get;private set;}
        public float Dt=>Settings==null?0:Settings.Timestep;
        public IReadOnlyList<Grain> Grains=>grains;
        public sealed class Grain {public Rigidbody body;public Renderer renderer;public float radius,mass;public bool large;}
        readonly BneCycleAverage cycleAverage=new BneCycleAverage();
        public IReadOnlyList<BneCyclePoint> CycleHistory=>cycleAverage.Points;
        double largeMassTotal,smallMassTotal;float currentLargeCom,currentSmallCom;
        readonly List<Grain> grains=new List<Grain>();
        GameObject contents; Rigidbody vial; Material smallMaterial,largeMaterial,wireMaterial;PhysicsMaterial grainContact,wallContact;
        BnePhase resumePhase;float accumulator,nextSample,rateClock,rateSim,lastElapsed;
        bool initialized;
        static Mesh grainMesh;
        static Mesh GrainMesh()
        {
            if(grainMesh!=null)return grainMesh;
            const int rings=10,slices=16;var vertices=new Vector3[(rings+1)*(slices+1)];var normals=new Vector3[vertices.Length];var triangles=new int[rings*slices*6];int index=0;
            for(int i=0;i<=rings;i++)for(int j=0;j<=slices;j++)
            {
                float p=i*Mathf.PI/rings,t=j*2*Mathf.PI/slices;var n=new Vector3(Mathf.Sin(p)*Mathf.Cos(t),Mathf.Cos(p),Mathf.Sin(p)*Mathf.Sin(t));int k=i*(slices+1)+j;vertices[k]=n*.5f;normals[k]=n;
            }
            for(int i=0;i<rings;i++)for(int j=0;j<slices;j++){int a=i*(slices+1)+j,b=a+slices+1;triangles[index++]=a;triangles[index++]=a+1;triangles[index++]=b;triangles[index++]=a+1;triangles[index++]=b+1;triangles[index++]=b;}
            grainMesh=new Mesh{name="Shared lightweight grain"};grainMesh.vertices=vertices;grainMesh.normals=normals;grainMesh.triangles=triangles;grainMesh.RecalculateBounds();return grainMesh;
        }
        public void Initialize()
        {
            if(initialized)return;initialized=true;
            Physics.simulationMode=SimulationMode.Script;
            // Length: mm, time: s, mass: mg. Uniform unit conversion preserves dynamics.
            Physics.gravity=new Vector3(0,-9810,0);Physics.defaultContactOffset=.01f;Physics.bounceThreshold=2f;
            Physics.defaultSolverIterations=24;Physics.defaultSolverVelocityIterations=8;
            var shader=Resources.Load<Shader>("BneGrain");
            if(shader==null)throw new InvalidOperationException("Missing BneGrain shader.");
            smallMaterial=new Material(shader){color=new Color(.57f,.74f,.79f),enableInstancing=true};
            largeMaterial=new Material(shader){color=new Color(.90f,.64f,.45f),enableInstancing=true};
            wireMaterial=new Material(Shader.Find("Sprites/Default")){color=new Color(.48f,.68f,.74f)};
            grainContact=new PhysicsMaterial("Grain contact");wallContact=new PhysicsMaterial("Wall contact");
        }
        void Awake()=>Initialize();
        public bool Prepare(BneSettings settings)
        {
            Initialize();
            List<BneGrainSpec> plan;
            try{plan=BnePacking.Generate(settings);}catch(Exception e){Error=e.Message;return false;}
            if(contents!=null){contents.SetActive(false);if(Application.isPlaying)Destroy(contents);else DestroyImmediate(contents);}
            grains.Clear();History.Clear();cycleAverage.Clear();largeMassTotal=smallMassTotal=0;Settings=settings.Copy();Error="";
            ShakeTime=SettleTime=RestTime=accumulator=nextSample=lastElapsed=rateClock=rateSim=0;PhysicsMilliseconds=0;
            ConfigureFriction(grainContact,wallContact,Settings.grainFriction,Settings.wallFriction);
            largeMaterial.SetFloat("_CutExempt",Settings.singleIntruder?1:0);
            grainContact.bounciness=wallContact.bounciness=Settings.bounce;
            grainContact.bounceCombine=wallContact.bounceCombine=PhysicsMaterialCombine.Maximum;
            contents=new GameObject("Experiment");contents.transform.SetParent(transform,false);
            MakeVial();
            foreach(var p in plan)
            {
                var go=GameObject.CreatePrimitive(PrimitiveType.Sphere);go.GetComponent<MeshFilter>().sharedMesh=GrainMesh();go.name=p.large?"Large grain":"Small grain";go.transform.SetParent(contents.transform,false);
                go.transform.localPosition=p.position;go.transform.localScale=Vector3.one*(2*p.radius);
                var renderer=go.GetComponent<Renderer>();renderer.sharedMaterial=p.large?largeMaterial:smallMaterial;
                var collider=go.GetComponent<SphereCollider>();collider.sharedMaterial=grainContact;collider.contactOffset=.01f;
                var rb=go.AddComponent<Rigidbody>();
                rb.mass=2500f*(p.large?Settings.densityRatio:1f)*4f/3f*Mathf.PI*Mathf.Pow(p.radius*.001f,3)*1000000;
                rb.linearDamping=0;rb.angularDamping=0;rb.maxAngularVelocity=1000;
                rb.collisionDetectionMode=(Settings.quality==0?CollisionDetectionMode.ContinuousSpeculative:CollisionDetectionMode.ContinuousDynamic);rb.solverIterations=Settings.quality==0?12:24;rb.solverVelocityIterations=Settings.quality==0?4:8;
                rb.sleepThreshold=.001f;rb.maxDepenetrationVelocity=10;
                grains.Add(new Grain{body=rb,renderer=renderer,radius=p.radius,mass=rb.mass,large=p.large});
            }
            foreach(var p in grains)if(p.large)largeMassTotal+=p.mass;else smallMassTotal+=p.mass;
            Physics.SyncTransforms();Phase=BnePhase.Settling;SetVisibility();return true;
        }
        void MakeVial()
        {
            var go=new GameObject("Kinematic cylindrical vial");go.transform.SetParent(contents.transform,false);
            vial=go.AddComponent<Rigidbody>();vial.isKinematic=true;vial.useGravity=false;vial.collisionDetectionMode=CollisionDetectionMode.ContinuousSpeculative;
            const int sides=48;float R=Settings.diameter*.5f,thickness=.5f;
            for(int i=0;i<sides;i++)
            {
                float angle=i*2*Mathf.PI/sides;Vector3 radial=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));
                var wall=new GameObject("Wall facet");wall.transform.SetParent(go.transform,false);
                wall.transform.localPosition=radial*(R+thickness*.5f)+Vector3.up*(Settings.height*.5f);
                wall.transform.localRotation=Quaternion.LookRotation(radial,Vector3.up);
                var c=wall.AddComponent<BoxCollider>();c.size=new Vector3(2*(R+thickness)*Mathf.Tan(Mathf.PI/sides),Settings.height+1,thickness);c.sharedMaterial=wallContact;c.contactOffset=.01f;
            }
            // Thick external caps retain the same inner floor/lid planes.
            const float capThickness=5f;
            foreach(float y in new[]{-capThickness*.5f,Settings.height+capThickness*.5f})
            {
                var cap=new GameObject("Sealed end");cap.transform.SetParent(go.transform,false);cap.transform.localPosition=Vector3.up*y;
                var c=cap.AddComponent<BoxCollider>();c.size=new Vector3(Settings.diameter+2,capThickness,Settings.diameter+2);c.sharedMaterial=wallContact;c.contactOffset=.01f;
            }
            Ring(go.transform,R,0);Ring(go.transform,R,Settings.height);
            for(int i=0;i<8;i++){float a=i*Mathf.PI/4;Line(go.transform,new[]{new Vector3(R*Mathf.Cos(a),0,R*Mathf.Sin(a)),new Vector3(R*Mathf.Cos(a),Settings.height,R*Mathf.Sin(a))});}
        }
        void Ring(Transform parent,float r,float y)
        {
            var points=new Vector3[65];for(int i=0;i<65;i++){float a=i*Mathf.PI/32;points[i]=new Vector3(r*Mathf.Cos(a),y,r*Mathf.Sin(a));}Line(parent,points);
        }
        void Line(Transform parent,Vector3[] points)
        {
            var go=new GameObject("Vial outline");go.transform.SetParent(parent,false);var line=go.AddComponent<LineRenderer>();line.useWorldSpace=false;
            line.sharedMaterial=wireMaterial;line.startWidth=line.endWidth=Mathf.Max(.025f,Settings.diameter*.003f);line.positionCount=points.Length;line.SetPositions(points);
        }
        public static void ConfigureFriction(PhysicsMaterial grain,PhysicsMaterial wall,float grainMu,float wallMu)
        {
            grain.dynamicFriction=grain.staticFriction=grainMu;wall.dynamicFriction=wall.staticFriction=wallMu;
            grain.frictionCombine=PhysicsMaterialCombine.Average;
            // Wall mode takes priority over Average, selecting exactly the requested wall coefficient.
            wall.frictionCombine=wallMu<grainMu?PhysicsMaterialCombine.Minimum:PhysicsMaterialCombine.Maximum;
        }
        public void TogglePause()
        {
            if(Phase==BnePhase.Paused){Phase=resumePhase;accumulator=0;return;}
            if(Phase==BnePhase.Ready){Phase=BnePhase.Shaking;accumulator=0;foreach(var p in grains)p.body.WakeUp();return;}
            if(Phase==BnePhase.Shaking||Phase==BnePhase.Resting||Phase==BnePhase.Settling){resumePhase=Phase;Phase=BnePhase.Paused;accumulator=0;}
        }
        public void StepOne()
        {
            if(Settings==null||Phase==BnePhase.Empty||Phase==BnePhase.Error||Phase==BnePhase.Ready||Phase==BnePhase.Complete||Phase==BnePhase.Paused)return;
            var phaseBefore=Phase;float shakeBefore=ShakeTime;
            float dt=Settings.Timestep;
            if(Phase==BnePhase.Settling)
            {
                dt=Mathf.Min(dt,Settings.SettlingDuration-SettleTime);Physics.Simulate(dt);SettleTime+=dt;
                if(SettleTime>=Settings.SettlingDuration-1e-6f){Phase=BnePhase.Ready;Initial=Sample();AddPoint();cycleAverage.Reset(Settings.frequency,Initial.largeCom,Initial.smallCom);Prepared?.Invoke();}
            }
            else if(Phase==BnePhase.Shaking)
            {
                dt=Mathf.Min(dt,Settings.duration-ShakeTime);float next=ShakeTime+dt;
                vial.MovePosition(Vector3.up*Displacement(Settings,next));Physics.Simulate(dt);ShakeTime=next;
                if(ShakeTime>=nextSample){AddPoint();nextSample+=1f/60f;}
                if(ShakeTime>=Settings.duration-1e-6f)Phase=BnePhase.Resting;
            }
            else if(Phase==BnePhase.Resting)
            {
                dt=Mathf.Min(dt,.5f-RestTime);Physics.Simulate(dt);RestTime+=dt;
                if(ShakeTime+RestTime>=nextSample){AddPoint();nextSample+=1f/60f;}
                if(RestTime>=.5f-1e-6f){Phase=BnePhase.Complete;AddPoint();Completed?.Invoke();}
            }
            CheckContainment();
            if(Phase!=BnePhase.Error)
            {
                if(phaseBefore==BnePhase.Shaking)cycleAverage.Advance(shakeBefore,ShakeTime,currentLargeCom,currentSmallCom);
                if(phaseBefore==BnePhase.Resting&&Phase==BnePhase.Complete)cycleAverage.AddRested(ShakeTime+RestTime,currentLargeCom,currentSmallCom);
            }
        }
        // Reject failed contact solutions instead of reporting an escaped-grain result.
        void CheckContainment()
        {
            float baseY=VialY;double largeMoment=0,smallMoment=0;
            foreach(var p in grains)
            {
                Vector3 v=p.body.position;float tolerance=p.radius;
                if(float.IsNaN(v.x+v.y+v.z)||float.IsInfinity(v.x+v.y+v.z)||
                    v.y-baseY-p.radius < -tolerance || v.y-baseY+p.radius > Settings.height+tolerance ||
                    new Vector2(v.x,v.z).magnitude+p.radius > Settings.diameter*.5f+tolerance)
                {
                    Error="The contact solver lost containment. Reset the sample and use finer physics resolution.";
                    Phase=BnePhase.Error;return;
                }
                if(p.large)largeMoment+=(v.y-baseY)*p.mass;else smallMoment+=(v.y-baseY)*p.mass;
            }
            currentLargeCom=largeMassTotal>0?(float)(largeMoment/largeMassTotal):0;currentSmallCom=smallMassTotal>0?(float)(smallMoment/smallMassTotal):0;
        }
        public static float Displacement(BneSettings s,float t)=>s.amplitude*(Mathf.Cos(2*Mathf.PI*s.frequency*t)-1);
        void Update()
        {
            if(Settings==null)return;
            if(Phase==BnePhase.Shaking||Phase==BnePhase.Settling||Phase==BnePhase.Resting)
            {
                accumulator=Mathf.Min(.15f,accumulator+Time.unscaledDeltaTime*(Phase==BnePhase.Settling?1f:Playback));
                double start=Time.realtimeSinceStartupAsDouble;int steps=0;
                while(accumulator>=Settings.Timestep && steps<96 && Time.realtimeSinceStartupAsDouble-start<.012)
                {
                    StepOne();accumulator-=Settings.Timestep;steps++;
                    if(Phase!=BnePhase.Shaking&&Phase!=BnePhase.Settling&&Phase!=BnePhase.Resting){accumulator=0;break;}
                }
                PhysicsMilliseconds=(Time.realtimeSinceStartupAsDouble-start)*1000;
            }
            float elapsed=SettleTime+ShakeTime+RestTime;rateClock+=Time.unscaledDeltaTime;rateSim+=elapsed-lastElapsed;lastElapsed=elapsed;
            if(rateClock>.5f){ActualRate=rateSim/rateClock;rateClock=rateSim=0;}
        }
        public BneSample Sample()
        {
            float baseY=VialY;float large=0,small=0,largeMass=0,smallMass=0,largeMoment=0,smallMoment=0,total=0,top=0;int nl=0,ns=0;
            foreach(var p in grains){float y=p.body.position.y-baseY;top=Mathf.Max(top,y+p.radius);total+=p.mass;if(p.large){large+=y;nl++;largeMass+=p.mass;largeMoment+=y*p.mass;}else{small+=y;ns++;smallMass+=p.mass;smallMoment+=y*p.mass;}}
            int q=0,h=0,t=0;foreach(var p in grains)if(p.large){float y=p.body.position.y-baseY;if(y>top*.25f)q++;if(y>top*.5f)h++;if(y>top*.75f)t++;}
            return new BneSample{time=ShakeTime,large=nl>0?large/nl:0,small=ns>0?small/ns:0,largeCom=largeMass>0?largeMoment/largeMass:0,smallCom=smallMass>0?smallMoment/smallMass:0,bedHeight=top,largeMassFraction=total>0?largeMass/total:0,aboveQuarter=nl>0?(float)q/nl:0,aboveHalf=nl>0?(float)h/nl:0,aboveThreeQuarters=nl>0?(float)t/nl:0};
        }
        void AddPoint(){var s=Sample();History.Add(new BnePoint{time=ShakeTime+RestTime,large=s.large,small=s.small,largeCom=s.largeCom,smallCom=s.smallCom});}
        public void SetVisibility(){foreach(var p in grains)p.renderer.enabled=!HideSmall||p.large;Shader.SetGlobalFloat("_BneCutEnabled",Cutaway?1:0);}
        public void SetCutPlane(Vector3 normal,Vector3 point){Shader.SetGlobalVector("_BneCutPlane",new Vector4(normal.x,normal.y,normal.z,-Vector3.Dot(normal,point)));}
        void OnApplicationFocus(bool focused){if(!focused&&(Phase==BnePhase.Shaking||Phase==BnePhase.Resting))TogglePause();}
        void OnDestroy()
        {
            if(!initialized)return;
            foreach(var obj in new UnityEngine.Object[]{smallMaterial,largeMaterial,wireMaterial,grainContact,wallContact})if(obj!=null){if(Application.isPlaying)Destroy(obj);else DestroyImmediate(obj);}
            Shader.SetGlobalFloat("_BneCutEnabled",0);
        }
    }
}
