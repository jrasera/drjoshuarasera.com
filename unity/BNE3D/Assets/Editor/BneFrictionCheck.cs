using System;
using UnityEngine;
namespace Bne3D.Editor
{
 public static class BneFrictionCheck
 {
  public static void Run()
  {
   var gravity=Physics.gravity;Physics.simulationMode=SimulationMode.Script;Physics.gravity=new Vector3(0,-10,0);
   try
   {
    foreach(var pair in new[]{new Vector2(.2f,.8f),new Vector2(.8f,.2f),new Vector2(0,.7f),new Vector2(1,0)})
    {
     var floor=new GameObject("Friction test floor");var grain=new GameObject("Friction test slider");
     var gm=new PhysicsMaterial("Test grain");var wm=new PhysicsMaterial("Test wall");
     try
     {
      BneSimulation.ConfigureFriction(gm,wm,pair.x,pair.y);
      var box=floor.AddComponent<BoxCollider>();box.size=new Vector3(100,1,100);box.sharedMaterial=wm;floor.transform.position=new Vector3(0,-.5f,0);
      var sphere=grain.AddComponent<SphereCollider>();sphere.radius=.5f;sphere.sharedMaterial=gm;grain.transform.position=new Vector3(0,.51f,0);
      var rb=grain.AddComponent<Rigidbody>();rb.constraints=RigidbodyConstraints.FreezeRotation;rb.linearDamping=rb.angularDamping=0;
      Physics.SyncTransforms();for(int i=0;i<120;i++)Physics.Simulate(1f/600);
      rb.linearVelocity=new Vector3(10,0,0);for(int i=0;i<60;i++)Physics.Simulate(1f/600);
      float expected=10-pair.y;if(Mathf.Abs(rb.linearVelocity.x-expected)>.025f)throw new Exception("Wall friction mismatch: grain="+pair.x+" wall="+pair.y+" expected="+expected+" actual="+rb.linearVelocity.x);
     }
     finally{UnityEngine.Object.DestroyImmediate(grain);UnityEngine.Object.DestroyImmediate(floor);UnityEngine.Object.DestroyImmediate(gm);UnityEngine.Object.DestroyImmediate(wm);}
    }
    Debug.Log("BNE_NATIVE_FRICTION_CHECKS_OK");
   }finally{Physics.gravity=gravity;}
  }
 }
}
