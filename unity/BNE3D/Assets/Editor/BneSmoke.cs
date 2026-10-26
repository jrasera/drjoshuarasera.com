using System;
using System.Diagnostics;
using System.IO;
using UnityEditor;
using UnityEngine;
using Debug=UnityEngine.Debug;

namespace Bne3D.Editor
{
    public static class BneSmoke
    {
        [Serializable]sealed class Report{public string unityVersion;public bool passed;public int particles,steps;public float timestep,simulatedSeconds;public double wallSeconds;public BneSample initial,final;}
        static void Check(bool ok,string message){if(!ok)throw new Exception("BNE check failed: "+message);}
        [MenuItem("BNE/Run physics checks")]
        public static void Run()
        {
            var settings=BneSettings.QuickSlice();settings.duration=.5f;settings.compact=false;settings.quality=1;
            var a=BnePacking.Generate(settings);var b=BnePacking.Generate(settings);
            Check(a.Count==270,"particle count");
            for(int i=0;i<a.Count;i++)
            {
                var p=a[i];Check(p.position==b[i].position&&p.radius==b[i].radius,"seeded packing reproducibility");
                Check(new Vector2(p.position.x,p.position.z).magnitude+p.radius<settings.diameter*.5f,"cylindrical packing");
                Check(p.position.y-p.radius>0&&p.position.y+p.radius<settings.height,"vertical packing bounds");
                for(int j=0;j<i;j++)Check((p.position-a[j].position).magnitude>p.radius+a[j].radius,"non-overlapping packing");
            }
            settings.layered=true;var layered=BnePacking.Generate(settings);float upperLarge=0,lowerSmall=float.PositiveInfinity;
            foreach(var p in layered)if(p.large)upperLarge=Mathf.Max(upperLarge,p.position.y+p.radius);else lowerSmall=Mathf.Min(lowerSmall,p.position.y-p.radius);
            Check(upperLarge<lowerSmall,"strict generated layers");settings.layered=false;
            var intruder=settings.Copy();intruder.singleIntruder=true;int large=0;foreach(var p in BnePacking.Generate(intruder))if(p.large)large++;Check(large==1,"one intruder");
            Check(Mathf.Abs(BneSimulation.Displacement(settings,.5f/settings.frequency)+2*settings.amplitude)<1e-5f,"full vial stroke");
            var go=new GameObject("BNE physics verification");var sim=go.AddComponent<BneSimulation>();sim.Initialize();
            var timer=Stopwatch.StartNew();int steps=0;
            try
            {
                Check(sim.Prepare(settings),"prepare: "+sim.Error);
                foreach(var p in sim.Grains){float expected=2500*4f/3f*Mathf.PI*Mathf.Pow(p.radius*.001f,3)*1000000;Check(Mathf.Abs(p.body.mass-expected)<expected*1e-5f,"spherical mass");Check(p.body.linearDamping==0&&p.body.angularDamping==0,"no aerodynamic damping");}
                while(sim.Phase==BnePhase.Settling&&steps++<20000)sim.StepOne();Check(sim.Phase==BnePhase.Ready,"settling finishes");
                sim.TogglePause();for(int i=0;i<20;i++){sim.StepOne();steps++;}sim.TogglePause();
                float paused=sim.ShakeTime;var position=sim.Grains[0].body.position;
                for(int i=0;i<20;i++)sim.StepOne();Check(sim.ShakeTime==paused&&sim.Grains[0].body.position==position,"pause freezes dynamics on first action");
                sim.TogglePause();
                while((sim.Phase==BnePhase.Shaking||sim.Phase==BnePhase.Resting)&&steps++<30000)sim.StepOne();
                Check(sim.Phase==BnePhase.Complete,"shaking and resting finish");Check(Mathf.Abs(sim.ShakeTime-settings.duration)<1e-5f,"physical shaking time");
                foreach(var p in sim.Grains)
                {
                    var v=p.body.position;Check(!float.IsNaN(v.x+v.y+v.z)&&!float.IsInfinity(v.x+v.y+v.z),"finite positions");
                    Check(new Vector2(v.x,v.z).magnitude+p.radius<settings.diameter*.5f+.25f,"no escape through side walls");
                    Check(v.y-sim.VialY-p.radius>-.25f&&v.y-sim.VialY+p.radius<settings.height+.25f,"no escape through end caps");
                }
                var camera=go.AddComponent<Camera>();var orbit=go.AddComponent<BneOrbitCamera>();orbit.Simulation=sim;orbit.Front();
                Check(orbit.HeadOn&&orbit.Yaw==0&&orbit.Pitch==0&&camera.orthographic,"head-on orthographic view");
                timer.Stop();var report=new Report{unityVersion=Application.unityVersion,passed=true,particles=sim.GrainCount,steps=steps,timestep=sim.Dt,simulatedSeconds=sim.SettleTime+sim.ShakeTime+sim.RestTime,wallSeconds=timer.Elapsed.TotalSeconds,initial=sim.Initial,final=sim.Sample()};
                string folder=Path.Combine(Directory.GetParent(Application.dataPath).FullName,"Builds");Directory.CreateDirectory(folder);File.WriteAllText(Path.Combine(folder,"smoke-report.json"),JsonUtility.ToJson(report,true));
                Debug.Log("BNE_PHYSICS_CHECKS_OK "+JsonUtility.ToJson(report));
                Check(sim.Prepare(settings),"prepare containment-failure test");
                sim.Grains[0].body.position=new Vector3(0,-20,0);Physics.SyncTransforms();sim.StepOne();
                Check(sim.Phase==BnePhase.Error&&sim.Error.Contains("containment"),"escaped grain stops experiment");
                Debug.Log("BNE_CONTAINMENT_GUARD_OK");
            }
            finally{UnityEngine.Object.DestroyImmediate(go);}
        }
    }
}
