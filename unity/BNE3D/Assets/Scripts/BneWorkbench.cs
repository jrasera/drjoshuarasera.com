using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Bne3D
{
    public sealed class BneWorkbench : MonoBehaviour
    {
        public BneSimulation Simulation {get;private set;}
        public BneOrbitCamera Orbit {get;private set;}
        bool setup,results,advanced,stylesReady;Vector2 scroll;BneSettings draft;
        readonly Dictionary<string,string> numbers=new Dictionary<string,string>();
        string notice="",error="";float uiScale=1;Rect modal,toolbar,header;
        GUIStyle panel,label,title,subheading,button,field,small,metric;Texture2D background,buttonTexture,fieldTexture;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot(){if(!Application.isBatchMode&&FindAnyObjectByType<BneWorkbench>()==null)new GameObject("BNE 3D workbench").AddComponent<BneWorkbench>();}
        void Awake()
        {
            Application.targetFrameRate=60;
            Simulation=gameObject.AddComponent<BneSimulation>();
            var cameraObject=new GameObject("Orbit camera");var camera=cameraObject.AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;
            camera.backgroundColor=new Color(.025f,.065f,.09f);camera.fieldOfView=43;camera.nearClipPlane=.01f;camera.farClipPlane=10000;
            Orbit=cameraObject.AddComponent<BneOrbitCamera>();Orbit.Simulation=Simulation;Orbit.Workbench=this;
            Simulation.Prepared+=()=>{Orbit.Fit();notice="Bed ready. Shake to start. Drag to orbit; scroll or pinch to zoom.";};
            Simulation.Completed+=()=>{results=true;notice="Shaking complete, followed by 0.5 s resting.";};
        }
        void Start(){
#if UNITY_WEBGL && !UNITY_EDITOR
            WebGLInput.captureAllKeyboardInput=false;
#endif
            Simulation.Cutaway=true;Simulation.Prepare(BneSettings.BuriedIntruder());Orbit.Fit(true);
        }
        // Browser controls use explicit messages, independently of canvas focus and IMGUI.
        public void WebCommand(string command)
        {
            switch(command)
            {
                case "play":Simulation.TogglePause();break;
                case "pause":PauseForOverlay();break;
                case "fit":Orbit.Fit();break;
                case "front":Orbit.Front();break;
                case "full":Orbit.Fit(true);break;
                case "cut":Simulation.Cutaway=!Simulation.Cutaway;Simulation.SetVisibility();break;
                case "hide":Simulation.HideSmall=!Simulation.HideSmall;Simulation.SetVisibility();break;
                case "reset":setup=results=false;error="";var settings=Simulation.Settings.Copy();settings.seed+=127;Simulation.Prepare(settings);Orbit.Fit(true);break;
                case "export":Export();break;
            }
            PublishWebState();
        }
        public void WebPlayback(string value)
        {
            if(float.TryParse(value,NumberStyles.Float,CultureInfo.InvariantCulture,out float rate))Simulation.Playback=Mathf.Clamp(rate,.1f,1f);
            PublishWebState();
        }
        public void WebApply(string json)
        {
            try
            {
                var settings=JsonUtility.FromJson<BneSettings>(json);
                if(settings==null)throw new ArgumentException("Check the sample settings.");
                if(!Simulation.Prepare(settings))throw new ArgumentException(Simulation.Error);
                notice="";setup=results=false;Orbit.Fit(true);error="";
            }
            catch(Exception e){error=e.Message;}
            PublishWebState();
        }
        [Serializable]sealed class WebState
        {
            public string phase,status,error;public int grains;public float time,duration,settled,rate,playback;
            public bool cut,hide,headOn;public BneSettings settings;public BneSample initial,current;public BnePoint[] history;public BneCyclePoint[] cycleHistory;
        }
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]static extern void BnePublishState(string json);
#endif
        BneCyclePoint[] WebCycles()
        {
            var history=Simulation.CycleHistory;int count=Math.Min(600,history.Count);var points=new BneCyclePoint[count];
            for(int i=0;i<count;i++)points[i]=history[count==1?0:(int)((long)i*(history.Count-1)/(count-1))];return points;
        }
        BnePoint[] WebHistory()
        {
            var history=Simulation.History;if(history.Count<=600)return history.ToArray();
            var points=new BnePoint[600];for(int i=0;i<600;i++)points[i]=history[(int)((long)i*(history.Count-1)/599)];return points;
        }
        void PublishWebState()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            if(Simulation.Settings==null)return;
            BnePublishState(JsonUtility.ToJson(new WebState{phase=Simulation.Phase.ToString(),status=Status(),error=error.Length>0?error:Simulation.Error,grains=Simulation.GrainCount,time=Simulation.ShakeTime,duration=Simulation.Settings.duration,settled=Simulation.SettleTime,rate=Simulation.ActualRate,playback=Simulation.Playback,cut=Simulation.Cutaway,hide=Simulation.HideSmall,headOn=Orbit.HeadOn,history=WebHistory(),cycleHistory=WebCycles(),settings=Simulation.Settings,initial=Simulation.Initial,current=Simulation.Sample()}));
#endif
        }
        float nextWebState;
        void Update()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            if(Time.unscaledTime>=nextWebState){nextWebState=Time.unscaledTime+.2f;PublishWebState();}
#endif
            if(GUIUtility.keyboardControl!=0)return;
            if(Input.GetKeyDown(KeyCode.Escape)){setup=results=false;return;}
#if !UNITY_WEBGL || UNITY_EDITOR
            if(setup||results)return;
#endif
            if(Input.GetKeyDown(KeyCode.Space))Simulation.TogglePause();
            if(Input.GetKeyDown(KeyCode.F))Orbit.Fit();
            if(Input.GetKeyDown(KeyCode.C)){Simulation.Cutaway=!Simulation.Cutaway;Simulation.SetVisibility();}
        }
        public bool BlocksPointer(Vector2 pixel)
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
            return false;
#endif
            if(setup||results)return true;
            var p=new Vector2(pixel.x/uiScale,(Screen.height-pixel.y)/uiScale);return toolbar.Contains(p)||header.Contains(p);
        }
        void MakeStyles()
        {
            if(stylesReady)return;stylesReady=true;
            background=Texture(new Color(.065f,.14f,.18f,.98f));buttonTexture=Texture(new Color(.17f,.30f,.35f));fieldTexture=Texture(new Color(.025f,.075f,.10f));
            panel=new GUIStyle(GUI.skin.box){padding=new RectOffset(22,22,20,20)};panel.normal.background=background;
            label=new GUIStyle(GUI.skin.label){fontSize=17,wordWrap=true};label.normal.textColor=new Color(.85f,.92f,.94f);
            title=new GUIStyle(label){fontSize=30,fontStyle=FontStyle.Bold};subheading=new GUIStyle(label){fontSize=21,fontStyle=FontStyle.Bold};
            small=new GUIStyle(label){fontSize=14};small.normal.textColor=new Color(.66f,.79f,.83f);
            metric=new GUIStyle(title){fontSize=26};metric.normal.textColor=new Color(.92f,.68f,.49f);
            button=new GUIStyle(GUI.skin.button){fontSize=16,padding=new RectOffset(13,13,11,11),margin=new RectOffset(3,3,3,3)};
            button.normal.background=buttonTexture;button.normal.textColor=new Color(.90f,.96f,.97f);
            button.hover.background=buttonTexture;button.hover.textColor=Color.white;button.active.background=fieldTexture;
            field=new GUIStyle(GUI.skin.textField){fontSize=17,padding=new RectOffset(8,8,8,8)};field.normal.background=fieldTexture;field.normal.textColor=Color.white;
        }
        static Texture2D Texture(Color color){var t=new Texture2D(1,1);t.SetPixel(0,0,color);t.Apply();return t;}
        void OnGUI()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return;
#endif
            MakeStyles();uiScale=Mathf.Clamp(Screen.width/1280f,.65f,1.5f);GUI.matrix=Matrix4x4.Scale(Vector3.one*uiScale);
            float w=Screen.width/uiScale,h=Screen.height/uiScale;header=new Rect(20,16,Mathf.Min(w-40,750),105);
            GUILayout.BeginArea(header);GUILayout.Label("Shake the bed. In three dimensions.",title);
            var s=Simulation.Settings;
            GUILayout.Label(s==null?"Preparing…":$"{Simulation.GrainCount:N0} spheres  ·  Ø {s.diameter:0.#} × {s.height:0.#} mm  ·  {s.frequency:0.#} Hz / {s.amplitude:0.##} mm  ·  Γ {s.Gamma:0.00}",label);
            GUILayout.Label(Status(),small);GUILayout.EndArea();
            toolbar=new Rect(20,h-126,w-40,110);GUILayout.BeginArea(toolbar);GUILayout.BeginHorizontal();
            GUI.enabled=Simulation.Phase!=BnePhase.Empty&&Simulation.Phase!=BnePhase.Complete;
            string play=Simulation.Phase==BnePhase.Ready?"Shake the bed ▶":Simulation.Phase==BnePhase.Paused?"Resume ▶":"Pause Ⅱ";
            if(GUILayout.Button(play,button,GUILayout.Width(170)))Simulation.TogglePause();GUI.enabled=true;
            if(GUILayout.Button("Set up sample",button)){OpenSetup();}
            if(GUILayout.Button("New arrangement",button)){var settings=s.Copy();settings.seed+=127;if(Simulation.Prepare(settings))Orbit.Fit(true);else notice=Simulation.Error;}
            if(GUILayout.Button("Results",button)){PauseForOverlay();results=true;}
            GUILayout.EndHorizontal();GUILayout.BeginHorizontal();
            if(GUILayout.Button("Fit bed",button))Orbit.Fit();if(GUILayout.Button("Full vial",button))Orbit.Fit(true);
            bool cut=GUILayout.Toggle(Simulation.Cutaway,"Cutaway",button);bool hide=GUILayout.Toggle(Simulation.HideSmall,"Hide small grains",button);
            if(cut!=Simulation.Cutaway||hide!=Simulation.HideSmall){Simulation.Cutaway=cut;Simulation.HideSmall=hide;Simulation.SetVisibility();}
            GUILayout.Label("Playback",small,GUILayout.Width(72));Simulation.Playback=GUILayout.HorizontalSlider(Simulation.Playback,.1f,1,GUILayout.Width(100));GUILayout.Label(Simulation.Playback.ToString("0.0")+"×",small,GUILayout.Width(35));
            GUILayout.EndHorizontal();GUILayout.EndArea();
            if(setup||results)
            {
                GUI.Box(new Rect(0,0,w,h),GUIContent.none,panel);
                modal=new Rect(Mathf.Max(12,(w-740)/2),20,Mathf.Min(740,w-24),h-40);
                GUILayout.BeginArea(modal,panel);if(setup)Setup();else Results();GUILayout.EndArea();
            }
        }
        string Status()
        {
            switch(Simulation.Phase)
            {
                case BnePhase.Settling:return $"Settling under gravity · {Simulation.SettleTime:0.00} / {Simulation.Settings.SettlingDuration:0.00} s";
                case BnePhase.Shaking:return $"Shaking · {Simulation.ShakeTime:0.00} / {Simulation.Settings.duration:0.#} s · running at {Simulation.ActualRate:0.00}× real time";
                case BnePhase.Resting:return $"Resting · {Simulation.RestTime:0.00} / 0.50 s";
                case BnePhase.Paused:return $"Paused at {Simulation.ShakeTime:0.00} s. Camera controls remain active.";
                case BnePhase.Error:return Simulation.Error;
                default:return notice;
            }
        }
        void PauseForOverlay(){if(Simulation.Phase==BnePhase.Shaking||Simulation.Phase==BnePhase.Resting||Simulation.Phase==BnePhase.Settling)Simulation.TogglePause();}
        void OpenSetup(){PauseForOverlay();LoadDraft(Simulation.Settings??new BneSettings());setup=true;results=false;error="";}
        void LoadDraft(BneSettings settings)
        {
            draft=settings.Copy();numbers.Clear();
            foreach(var info in typeof(BneSettings).GetFields())
                if(info.Name!="quality"&&(info.FieldType==typeof(float)||info.FieldType==typeof(int)))numbers[info.Name]=Convert.ToString(info.GetValue(draft),CultureInfo.InvariantCulture);
        }
        void Setup()
        {
            RowTitle("Build a granular bed",()=>setup=false);
            scroll=GUILayout.BeginScrollView(scroll);
            GUILayout.Label("Starting sample",subheading);
            draft.singleIntruder=GUILayout.SelectionGrid(draft.singleIntruder?0:1,new[]{"Single intruder","Two size fractions"},2,button)==0;
            draft.layered=GUILayout.SelectionGrid(draft.layered?1:0,new[]{"Stochastic mixture","Large below small"},2,button)==1;
            Field("Small grains","smallCount");
            if(draft.singleIntruder){GUILayout.Label("Large grains: 1 intruder",label);Field("Intruder / mean small diameter","intruderRatio");}
            else Field("Large grains","largeCount");
            Pair("Small minimum (mm)","smallMin","Small maximum (mm)","smallMax");
            if(!draft.singleIntruder)Pair("Large minimum (mm)","largeMin","Large maximum (mm)","largeMax");
            Pair("Vial diameter (mm)","diameter","Vial height (mm)","height");
            GUILayout.Space(12);GUILayout.Label("Vibration",subheading);
            Pair("Frequency (Hz)","frequency","Peak amplitude (mm)","amplitude");Field("Shaking duration (s)","duration");
            GUILayout.Label("Earth gravity. Full stroke = twice the peak amplitude. No air forces.",small);
            GUILayout.Space(12);GUILayout.Label("Load a starting point",subheading);
            GUILayout.BeginHorizontal();
            if(GUILayout.Button("Quick 20 / 250 mix",button))LoadDraft(BneSettings.QuickSlice());
            if(GUILayout.Button("Paper-inspired test 7",button))LoadDraft(BneSettings.PaperMixture(7));
            if(GUILayout.Button("Paper-inspired test 8",button))LoadDraft(BneSettings.PaperMixture(8));
            GUILayout.EndHorizontal();GUILayout.Label("The paper-inspired mixture uses 70 large / 4,000 small spheres and the published size bounds. Uniform size sampling and game-physics contacts are approximations; these are not validated reproductions.",small);
            advanced=GUILayout.Toggle(advanced,"Contact and performance settings",button);
            if(advanced)
            {
                Pair("Grain friction","grainFriction","Wall friction","wallFriction");Pair("Contact bounce (0–1)","bounce","Large / small density","densityRatio");Field("Arrangement seed","seed");
                GUILayout.Label("Physics quality",label);draft.quality=GUILayout.SelectionGrid(draft.quality,new[]{"Fast","Balanced","Finer"},3,button);
                GUILayout.Label("Unity rigid-body contacts replace elastic DEM. Drag and angular damping are zero; friction and contact bounce dissipate energy. Finer steps cost more computation. Counts are limited to 5,000.",small);
            }
            if(error.Length>0){GUI.contentColor=new Color(1,.66f,.5f);GUILayout.Label(error,label);GUI.contentColor=Color.white;}
            GUILayout.EndScrollView();
            if(GUILayout.Button("Apply and settle",button))
            {
                if(ReadDraft()&&Simulation.Prepare(draft)){setup=false;notice="";Orbit.Fit(true);}else if(error.Length==0)error=Simulation.Error;
            }
        }
        void Field(string caption,string key)
        {
            GUILayout.BeginHorizontal();GUILayout.Label(caption,label,GUILayout.MinWidth(180));numbers[key]=GUILayout.TextField(numbers[key],field,GUILayout.Width(140));GUILayout.EndHorizontal();
        }
        void Pair(string a,string ka,string b,string kb){Field(a,ka);Field(b,kb);}
        bool ReadDraft()
        {
            error="";
            foreach(var item in numbers)
            {
                var info=typeof(BneSettings).GetField(item.Key);
                if(info.FieldType==typeof(int)){if(!int.TryParse(item.Value,NumberStyles.Integer,CultureInfo.InvariantCulture,out int value)){error="Enter whole numbers for particle counts, quality and seed.";return false;}info.SetValue(draft,value);}
                else{if(!float.TryParse(item.Value,NumberStyles.Float,CultureInfo.InvariantCulture,out float value)){error="Enter valid numbers using a decimal point.";return false;}info.SetValue(draft,value);}
            }
            error=draft.Validate()??"";return error.Length==0;
        }
        void RowTitle(string text,Action close){GUILayout.BeginHorizontal();GUILayout.Label(text,title);if(GUILayout.Button("Close ×",button,GUILayout.Width(105)))close();GUILayout.EndHorizontal();}
        void Results()
        {
            RowTitle("Did the large grains rise?",()=>results=false);scroll=GUILayout.BeginScrollView(scroll);
            var sample=Simulation.Sample();GUILayout.Label($"Large − small mean height: {sample.separation:+0.00;-0.00;0.00} mm",metric);
            GUILayout.Label($"Initial: {Simulation.Initial.separation:+0.00;-0.00;0.00} mm  ·  Change: {sample.separation-Simulation.Initial.separation:+0.00;-0.00;0.00} mm",label);
            GUILayout.Label($"Coarse mass share {sample.largeMassFraction*100:0.0}%  ·  Bed height {sample.bedHeight:0.0} mm",label);
            GUILayout.Label($"Large grains above ¼ / ½ / ¾ bed height: {sample.aboveQuarter*100:0}% / {sample.aboveHalf*100:0}% / {sample.aboveThreeQuarters*100:0}%",label);
            Rect chart=GUILayoutUtility.GetRect(200,190,GUILayout.ExpandWidth(true));DrawChart(chart);
            GUILayout.Label("Copper: large-grain mean height. Blue: small-grain mean height. Heights are number means measured from the moving vial floor.",small);
            GUILayout.Label($"{Simulation.ShakeTime:0.00} s shaking + {Simulation.RestTime:0.00} s resting · {Simulation.GrainCount:N0} spheres · physics step {Simulation.Dt*1000:0.000} ms",small);
            GUILayout.Space(12);GUILayout.Label("An interactive rigid-body experiment",subheading);
            GUILayout.Label("Motion comes from gravity, friction and collisions; no upward drift is prescribed. This model is intended for exploring segregation. It has not been validated against the Albino experiments and does not reproduce Hertz–Mindlin contacts.",label);
            if(GUILayout.Button("Save settings and results (JSON)",button))Export();
            if(notice.Length>0)GUILayout.Label(notice,small);
            GUILayout.EndScrollView();
        }
        void DrawChart(Rect area)
        {
            if(Event.current.type!=EventType.Repaint||Simulation.History.Count<2)return;
            var points=Simulation.History;float high=1;foreach(var p in points)high=Mathf.Max(high,p.large,p.small);high*=1.15f;
            Rect plot=new Rect(area.x+35,area.y+12,area.width-55,area.height-40);float duration=Mathf.Max(.1f,Simulation.ShakeTime+Simulation.RestTime);
            Segment(new Vector2(plot.x,plot.y),new Vector2(plot.x,plot.yMax),new Color(.4f,.6f,.65f));Segment(new Vector2(plot.x,plot.yMax),new Vector2(plot.xMax,plot.yMax),new Color(.4f,.6f,.65f));
            for(int i=1;i<points.Count;i++)
            {
                var a=points[i-1];var b=points[i];
                Segment(new Vector2(plot.x+a.time/duration*plot.width,plot.yMax-a.large/high*plot.height),new Vector2(plot.x+b.time/duration*plot.width,plot.yMax-b.large/high*plot.height),new Color(.90f,.64f,.45f));
                Segment(new Vector2(plot.x+a.time/duration*plot.width,plot.yMax-a.small/high*plot.height),new Vector2(plot.x+b.time/duration*plot.width,plot.yMax-b.small/high*plot.height),new Color(.57f,.74f,.79f));
            }
            GUI.Label(new Rect(area.x,area.y,35,24),high.ToString("0"),small);GUI.Label(new Rect(plot.x,plot.yMax+4,50,24),"0 s",small);GUI.Label(new Rect(plot.xMax-60,plot.yMax+4,70,24),duration.ToString("0.0")+" s",small);
        }
        static void Segment(Vector2 a,Vector2 b,Color color)
        {
            var matrix=GUI.matrix;var before=GUI.color;GUI.color=color;GUIUtility.RotateAroundPivot(Mathf.Atan2(b.y-a.y,b.x-a.x)*Mathf.Rad2Deg,a);
            GUI.DrawTexture(new Rect(a.x,a.y,(b-a).magnitude,2),Texture2D.whiteTexture);GUI.matrix=matrix;GUI.color=before;
        }
        [Serializable] sealed class Report
        {
            public string model="Unity PhysX 3D rigid-body demonstrator",phase;
            public string unityVersion=Application.unityVersion,platform=Application.platform.ToString();public bool validated=false;
            public string historyTime="Seconds since shaking started, including the final rest.";
            public string cycleAveraging="Time-weighted base-relative CoM over complete vibration cycles; the initial and final rested points are instantaneous.";
            public string units="diameters and heights: mm; time: s; numerical mass: mg; density: 2500 kg/m3; spherical masses";
            public BneSettings settings;public BneSample initial,current;public BnePoint[] history;public BneCyclePoint[] cycleHistory;public float timestep;
        }
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]static extern void BneDownloadJson(string name,string json);
#endif
        void Export()
        {
            if(Simulation.Phase==BnePhase.Error){notice=Simulation.Error;return;}
            string json=JsonUtility.ToJson(new Report{phase=Simulation.Phase.ToString(),settings=Simulation.Settings.Copy(),initial=Simulation.Initial,current=Simulation.Sample(),history=Simulation.History.ToArray(),cycleHistory=WebCycles(),timestep=Simulation.Dt},true);
#if UNITY_WEBGL && !UNITY_EDITOR
            BneDownloadJson("bne-3d-results.json",json);notice="Results downloaded.";
#else
            string path=Path.Combine(Application.persistentDataPath,"bne-3d-results.json");File.WriteAllText(path,json);notice="Saved "+path;
#endif
        }
        void OnDestroy(){foreach(var t in new[]{background,buttonTexture,fieldTexture})if(t!=null)Destroy(t);}
    }
}
