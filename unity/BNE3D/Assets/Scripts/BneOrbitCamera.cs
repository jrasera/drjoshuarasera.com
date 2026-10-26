using UnityEngine;
namespace Bne3D
{
    public sealed class BneOrbitCamera : MonoBehaviour
    {
        public BneSimulation Simulation;public BneWorkbench Workbench;
        public Vector3 Target;public float Distance=80,Yaw=0,Pitch=0;
        public bool HeadOn=true;
        Vector3 previousMouse;
        public void Front(){HeadOn=true;Yaw=Pitch=0;var camera=GetComponent<Camera>();if(camera!=null)camera.orthographic=true;Fit();}
        public void Fit(bool fullVial=false)
        {
            if(Simulation?.Settings==null)return;
            float height=fullVial?Simulation.Settings.height:Mathf.Max(3,Simulation.Sample().bedHeight+Simulation.Settings.amplitude*2);
            float r=Simulation.Settings.diameter*.5f;
            Target=new Vector3(0,height*.48f+Simulation.VialY,0);
            Distance=Mathf.Sqrt(r*r+height*height*.25f)/Mathf.Tan(21.5f*Mathf.Deg2Rad)*1.65f;
        }
        void LateUpdate()
        {
            if(Simulation?.Settings==null)return;
            bool blocked=Workbench!=null&&Workbench.BlocksPointer(Input.mousePosition);
            if(!blocked)
            {
                if(Input.touchCount==2)
                {
                    var a=Input.GetTouch(0);var b=Input.GetTouch(1);
                    float current=(a.position-b.position).magnitude,previous=((a.position-a.deltaPosition)-(b.position-b.deltaPosition)).magnitude;
                    if(current>1)Distance*=previous/current;
                }
                else if(Input.GetMouseButton(0)&&!Input.GetMouseButtonDown(0)){var delta=Input.mousePosition-previousMouse;if(delta.sqrMagnitude>.01f)HeadOn=false;Yaw+=delta.x*.25f;Pitch=Mathf.Clamp(Pitch-delta.y*.2f,-75,80);}
                Distance*=Mathf.Exp(-Input.mouseScrollDelta.y*.12f);
            }
            previousMouse=Input.mousePosition;
            Distance=Mathf.Clamp(Distance,Simulation.Settings.diameter*.4f,3000);
            // Lab-fixed camera: never cancel the prescribed vial motion by following it.
            var camera=GetComponent<Camera>();camera.orthographic=HeadOn;camera.orthographicSize=Distance*Mathf.Tan(camera.fieldOfView*.5f*Mathf.Deg2Rad);
            transform.position=Target+(HeadOn?Vector3.back:Quaternion.Euler(Pitch,Yaw,0)*Vector3.back)*Distance;transform.LookAt(Target);
            Vector3 normal=transform.position-Target;normal.y=0;normal.Normalize();Simulation.SetCutPlane(normal,Vector3.zero);
        }
    }
}
