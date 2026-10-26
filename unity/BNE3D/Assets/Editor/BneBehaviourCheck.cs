using System;
using System.IO;
using System.Diagnostics;
using UnityEngine;
using Debug=UnityEngine.Debug;
namespace Bne3D.Editor
{
 public static class BneBehaviourCheck
 {
  [Serializable]class Result{public string name;public float frequency,amplitude,initialLarge,initialSmall,initialBed,finalLarge,finalSmall,finalBed,rise,relativeRise,maxFloorCommandError;public double wallSeconds;}
  [Serializable]class Report{public Result[] runs;}
  public static void Run()
  {
   var frequencies=new[]{15f,20f,25f,35f,25f};var amplitudes=new[]{1.5f,1.5f,1f,.6f,0f};var results=new Result[5];
   for(int test=0;test<5;test++)
   {
    var s=new BneSettings{singleIntruder=true,layered=true,smallCount=400,smallMin=.95f,smallMax=1.05f,intruderRatio=3,diameter=9,height=60,frequency=frequencies[test],amplitude=amplitudes[test],duration=3};
    var go=new GameObject("Segregation behaviour check");var sim=go.AddComponent<BneSimulation>();var timer=Stopwatch.StartNew();var r=new Result{name=test==4?"unshaken":"driven-"+test,frequency=s.frequency,amplitude=s.amplitude};
    try{
     if(!sim.Prepare(s))throw new Exception(sim.Error);while(sim.Phase==BnePhase.Settling)sim.StepOne();if(sim.Phase!=BnePhase.Ready)throw new Exception(sim.Error);
     var initial=sim.Sample();r.initialLarge=initial.largeCom;r.initialSmall=initial.smallCom;r.initialBed=initial.bedHeight;
     // A common rigid translation must leave all base-relative heights unchanged.
     var vial=go.transform.Find("Experiment/Kinematic cylindrical vial").GetComponent<Rigidbody>();
     vial.position+=Vector3.up*10;foreach(var p in sim.Grains)p.body.position+=Vector3.up*10;Physics.SyncTransforms();
     var translated=sim.Sample();if(Mathf.Abs(translated.largeCom-initial.largeCom)>1e-4f||Mathf.Abs(translated.smallCom-initial.smallCom)>1e-4f)throw new Exception("CoM reference frame is not translation invariant");
     vial.position-=Vector3.up*10;foreach(var p in sim.Grains)p.body.position-=Vector3.up*10;Physics.SyncTransforms();
     sim.TogglePause();while(sim.Phase==BnePhase.Shaking||sim.Phase==BnePhase.Resting){sim.StepOne();if(sim.Phase==BnePhase.Shaking)r.maxFloorCommandError=Mathf.Max(r.maxFloorCommandError,Mathf.Abs(sim.VialY-BneSimulation.Displacement(s,sim.ShakeTime)));}
     if(sim.Phase!=BnePhase.Complete)throw new Exception(sim.Error);var final=sim.Sample();r.finalLarge=final.largeCom;r.finalSmall=final.smallCom;r.finalBed=final.bedHeight;r.rise=final.largeCom-initial.largeCom;r.relativeRise=(final.largeCom-final.smallCom)-(initial.largeCom-initial.smallCom);r.wallSeconds=timer.Elapsed.TotalSeconds;results[test]=r;
     if(r.maxFloorCommandError>1e-4f)throw new Exception("Moving floor is out of sync");Debug.Log("BNE_BEHAVIOUR_CHECK "+JsonUtility.ToJson(r));
    }finally{UnityEngine.Object.DestroyImmediate(go);}
   }
   Directory.CreateDirectory("Builds");File.WriteAllText("Builds/behaviour-report.json",JsonUtility.ToJson(new Report{runs=results},true));
  }
 }
}
