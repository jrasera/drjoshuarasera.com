using System;
using System.Collections.Generic;
namespace Bne3D
{
 [Serializable]public struct BneCyclePoint{public float time,largeCom,smallCom;}
 // Integrate measured, base-relative CoM. No container displacement is subtracted here.
 public sealed class BneCycleAverage
 {
  public readonly List<BneCyclePoint> Points=new List<BneCyclePoint>();
  double period,weight,largeIntegral,smallIntegral;int cycle;float previousLarge,previousSmall;
  public void Clear(){Points.Clear();weight=largeIntegral=smallIntegral=0;cycle=0;period=0;}
  public void Reset(float frequency,float large,float small){Clear();period=frequency>0?1.0/frequency:0;previousLarge=large;previousSmall=small;Points.Add(new BneCyclePoint{time=0,largeCom=large,smallCom=small});}
  public void Advance(float start,float end,float large,float small)
  {
   if(period<=0||end<=start){previousLarge=large;previousSmall=small;return;}
   double cursor=start,span=end-start;
   while(cursor<end-1e-10)
   {
    double boundary=(cycle+1)*period,stop=Math.Min(end,boundary);
    if(stop<=cursor+1e-10){Finish();continue;}
    double a=(cursor-start)/span,b=(stop-start)/span,dt=stop-cursor;
    largeIntegral+=dt*(previousLarge+(large-previousLarge)*(a+b)*.5);
    smallIntegral+=dt*(previousSmall+(small-previousSmall)*(a+b)*.5);weight+=dt;cursor=stop;
    if(cursor>=boundary-1e-10)Finish();
   }
   previousLarge=large;previousSmall=small;
  }
  void Finish(){if(weight>1e-10)Points.Add(new BneCyclePoint{time=(float)((cycle+.5)*period),largeCom=(float)(largeIntegral/weight),smallCom=(float)(smallIntegral/weight)});cycle++;weight=largeIntegral=smallIntegral=0;}
  public void AddRested(float time,float large,float small){Points.Add(new BneCyclePoint{time=time,largeCom=large,smallCom=small});}
 }
}
