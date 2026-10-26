using System;
using System.IO;
using System.Diagnostics;
using UnityEngine;
using Debug=UnityEngine.Debug;
namespace Bne3D.Editor
{
 public static class BneInteractiveCheck
 {
  [Serializable]class Result{public string preset;public int particles,steps;public double generationSeconds,readySeconds,totalSeconds;public float dt,minFloor,maxSide,restRms;public BneSample final;}
  [Serializable]class Report{public Result[] runs;}
  public static void ValidateAndBuild(){BneFrictionCheck.Run();Run();BneBuild.ValidateAndBuildWeb();}
  public static void Run()
  {
   var runs=new Result[4];for(int test=0;test<4;test++)
   {
    var settings=test==0?BneSettings.QuickSlice():test==1?BneSettings.PaperPreview():BneSettings.PaperMixture(test==2?7:8);
    var watch=Stopwatch.StartNew();var go=new GameObject("Interactive preset check");var sim=go.AddComponent<BneSimulation>();
    var r=new Result{preset=test==0?"quick":test==1?"paper-preview":test==2?"paper7":"paper8",particles=settings.smallCount+settings.LargeCount,dt=settings.Timestep};
    try
    {
     if(!sim.Prepare(settings))throw new Exception(sim.Error);r.generationSeconds=watch.Elapsed.TotalSeconds;
     while(sim.Phase==BnePhase.Settling){sim.StepOne();Inspect(sim,r);}if(sim.Phase!=BnePhase.Ready)throw new Exception(sim.Error);r.readySeconds=watch.Elapsed.TotalSeconds;
     // Check the reported CoM against direct mass-weighted sums.
     double moment=0,mass=0;foreach(var p in sim.Grains)if(p.large){moment+=p.body.mass*(p.body.position.y-sim.VialY);mass+=p.body.mass;}
     if(Math.Abs(sim.Sample().largeCom-moment/mass)>1e-4)throw new Exception("Incorrect mass-weighted CoM");
     sim.TogglePause();while(sim.Phase==BnePhase.Shaking||sim.Phase==BnePhase.Resting){sim.StepOne();Inspect(sim,r);}
     if(sim.Phase!=BnePhase.Complete)throw new Exception(sim.Error);r.final=sim.Sample();double energy=0;foreach(var p in sim.Grains)energy+=p.body.linearVelocity.sqrMagnitude;r.restRms=(float)Math.Sqrt(energy/sim.GrainCount);
     if(r.minFloor<-.1f||r.maxSide>.15f||r.restRms>10f)throw new Exception("Interactive contact stability regression: "+JsonUtility.ToJson(r));
     r.totalSeconds=watch.Elapsed.TotalSeconds;runs[test]=r;Debug.Log("BNE_INTERACTIVE_CHECK "+JsonUtility.ToJson(r));
    }
    finally{UnityEngine.Object.DestroyImmediate(go);}
   }
   Directory.CreateDirectory("Builds");File.WriteAllText("Builds/interactive-report.json",JsonUtility.ToJson(new Report{runs=runs},true));
  }
  static void Inspect(BneSimulation sim,Result r){r.steps++;foreach(var p in sim.Grains){r.minFloor=Mathf.Min(r.minFloor,p.body.position.y-sim.VialY-p.radius);r.maxSide=Mathf.Max(r.maxSide,new Vector2(p.body.position.x,p.body.position.z).magnitude+p.radius-sim.Settings.diameter*.5f);}}
 }
}
