using System;
using UnityEngine;
namespace Bne3D.Editor
{
 public static class BneCycleAverageCheck
 {
  public static void Run()
  {
   const float frequency=17;var average=new BneCycleAverage();average.Reset(frequency,5,2.7f);float time=0,end=5f/frequency;int step=0;
   while(time<end){float next=Mathf.Min(end,time+(1f/frequency/53)*(step++%3==0?1.13f:.94f));average.Advance(time,next,5+.2f*next+1.5f*Mathf.Sin(2*Mathf.PI*frequency*next),2-.1f*next+.7f*Mathf.Cos(2*Mathf.PI*frequency*next));time=next;}
   if(average.Points.Count<5)throw new Exception("Cycle means missing");
   for(int i=1;i<average.Points.Count;i++){var p=average.Points[i];if(Mathf.Abs(p.largeCom-(5+.2f*p.time))>.002f||Mathf.Abs(p.smallCom-(2-.1f*p.time))>.002f)throw new Exception("Cycle averaging does not preserve the trend while cancelling periodic motion");}
   average.AddRested(1,6,3);if(average.Points[average.Points.Count-1].largeCom!=6)throw new Exception("Rested endpoint missing");
   Debug.Log("BNE_CYCLE_AVERAGE_CHECKS_OK");
  }
 }
}
