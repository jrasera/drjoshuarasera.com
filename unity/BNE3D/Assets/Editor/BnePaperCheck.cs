using System;
using System.IO;
using UnityEditor;
using UnityEngine;
namespace Bne3D.Editor
{
 public static class BnePaperCheck
 {
  [Serializable]public class Result{public int condition,particles,steps,escaped;public float dt,minFloor=0,maxSide=0,settledRms,restRms,maxSpeed,endFloor,endSide;public double wallSeconds;public BneSample initial,final;}
  [MenuItem("BNE/Run full paper containment checks")]
  public static void RunBoth()
  {
   Environment.SetEnvironmentVariable("BNE_SECONDS","10");
   foreach(int condition in new[]{7,8}){Environment.SetEnvironmentVariable("BNE_CONDITION",condition.ToString());Run();}
  }
  public static void Run()
  {
   int condition=int.TryParse(Environment.GetEnvironmentVariable("BNE_CONDITION"),out var value)?value:8;
   var s=BneSettings.PaperMixture(condition);s.quality=1;s.compact=false;s.duration=float.TryParse(Environment.GetEnvironmentVariable("BNE_SECONDS"),out var duration)?duration:1;
   if(int.TryParse(Environment.GetEnvironmentVariable("BNE_QUALITY"),out var quality))s.quality=quality;
   var go=new GameObject("Paper containment check");var sim=go.AddComponent<BneSimulation>();var r=new Result{condition=condition,particles=s.smallCount+s.LargeCount,dt=s.Timestep};var timer=System.Diagnostics.Stopwatch.StartNew();
   try{
    if(!sim.Prepare(s))throw new Exception(sim.Error);
    while(sim.Phase==BnePhase.Settling){sim.StepOne();Inspect(sim,r);}
    r.settledRms=Rms(sim);r.initial=sim.Sample();sim.TogglePause();
    while(sim.Phase==BnePhase.Shaking||sim.Phase==BnePhase.Resting){sim.StepOne();Inspect(sim,r);}
    if(sim.Phase!=BnePhase.Complete)throw new Exception("Paper preset did not finish: "+sim.Error);
    r.restRms=Rms(sim);r.final=sim.Sample();foreach(var p in sim.Grains){r.endFloor=Mathf.Min(r.endFloor,p.body.position.y-sim.VialY-p.radius);r.endSide=Mathf.Max(r.endSide,new Vector2(p.body.position.x,p.body.position.z).magnitude+p.radius-s.diameter*.5f);}foreach(var p in sim.Grains)if(p.body.position.y-sim.VialY+p.radius<0)r.escaped++;
    if(r.escaped!=0||r.minFloor<-.1f||r.maxSide>.15f||r.endFloor<-.05f||r.endSide>.05f||r.restRms>5f)
     throw new Exception("Paper preset containment/rest regression: "+JsonUtility.ToJson(r));
    timer.Stop();r.wallSeconds=timer.Elapsed.TotalSeconds;Directory.CreateDirectory("Builds");File.WriteAllText("Builds/paper-check-"+condition+".json",JsonUtility.ToJson(r,true));Debug.Log("BNE_PAPER_CHECK "+JsonUtility.ToJson(r));
   }finally{UnityEngine.Object.DestroyImmediate(go);}
  }
  static float Rms(BneSimulation sim){double sum=0;foreach(var p in sim.Grains)sum+=p.body.linearVelocity.sqrMagnitude;return (float)Math.Sqrt(sum/sim.GrainCount);}
  static void Inspect(BneSimulation sim,Result r){r.steps++;foreach(var p in sim.Grains){var pos=p.body.position;float floor=pos.y-sim.VialY-p.radius;r.minFloor=Mathf.Min(r.minFloor,floor);r.maxSide=Mathf.Max(r.maxSide,new Vector2(pos.x,pos.z).magnitude+p.radius-sim.Settings.diameter*.5f);r.maxSpeed=Mathf.Max(r.maxSpeed,p.body.linearVelocity.magnitude);if(float.IsNaN(pos.y)||float.IsInfinity(pos.y))throw new Exception("Non-finite grain");}if(r.steps%1000==0)Debug.Log("BNE_PAPER_PROGRESS "+r.steps+" phase="+sim.Phase+" floor="+r.minFloor);}
 }
}
