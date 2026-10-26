using System;
using System.IO;
using UnityEngine;
namespace Bne3D.Editor
{
 public static class BneDemoCheck
 {
  [Serializable]class Result{public int seed,quality;public bool driven;public float initialLarge,finalLarge,rise,relativeRise,initialBed,baseError,rawRange,cycleRange;public int cycles;}
  [Serializable]class Report{public Result[] runs;}
  public static void ValidateAndBuild(){Run();BneBuild.ValidateAndBuildWeb();}
  public static void Run()
  {
   BneCycleAverageCheck.Run();var results=new Result[5];
   for(int test=0;test<5;test++)
   {
    var s=BneSettings.BuriedIntruder();s.seed=test%2==0?87413:87540;if(test==2||test==3)s.amplitude=0;if(test==4)s.quality=1;
    var go=new GameObject("Buried intruder regression");var sim=go.AddComponent<BneSimulation>();var r=new Result{seed=s.seed,quality=s.quality,driven=s.amplitude>0};
    try
    {
     if(!sim.Prepare(s))throw new Exception(sim.Error);while(sim.Phase==BnePhase.Settling)sim.StepOne();if(sim.Phase!=BnePhase.Ready)throw new Exception(sim.Error);
     var initial=sim.Sample();r.initialLarge=initial.largeCom;r.initialBed=initial.bedHeight;sim.TogglePause();
     while(sim.Phase==BnePhase.Shaking||sim.Phase==BnePhase.Resting){sim.StepOne();if(sim.Phase==BnePhase.Shaking)r.baseError=Mathf.Max(r.baseError,Mathf.Abs(sim.VialY-BneSimulation.Displacement(s,sim.ShakeTime)));}
     if(sim.Phase!=BnePhase.Complete)throw new Exception(sim.Error);var final=sim.Sample();r.finalLarge=final.largeCom;r.rise=final.largeCom-initial.largeCom;r.relativeRise=(final.largeCom-final.smallCom)-(initial.largeCom-initial.smallCom);r.cycles=sim.CycleHistory.Count-2;
     float rawMin=float.PositiveInfinity,rawMax=float.NegativeInfinity,cycleMin=rawMin,cycleMax=rawMax;
     foreach(var p in sim.History)if(p.time>=2.5f&&p.time<=3){rawMin=Mathf.Min(rawMin,p.largeCom);rawMax=Mathf.Max(rawMax,p.largeCom);}
     foreach(var p in sim.CycleHistory)if(p.time>=2.5f&&p.time<=3){cycleMin=Mathf.Min(cycleMin,p.largeCom);cycleMax=Mathf.Max(cycleMax,p.largeCom);}
     r.rawRange=rawMax-rawMin;r.cycleRange=cycleMax-cycleMin;
     Debug.Log("BNE_DEMO_CHECK "+JsonUtility.ToJson(r));
     if(r.baseError>1e-4f||r.cycles<59)throw new Exception("Frame or cycle accounting failed");
     if(r.driven&&(r.rise<1||r.relativeRise<1))throw new Exception("No clear intruder rise in the driven demo");
     if(!r.driven&&Mathf.Abs(r.rise)>.25f)throw new Exception("Unshaken intruder rose without forcing");results[test]=r;
    }finally{UnityEngine.Object.DestroyImmediate(go);}
   }
   Directory.CreateDirectory("Builds");File.WriteAllText("Builds/demo-report.json",JsonUtility.ToJson(new Report{runs=results},true));
  }
 }
}
