using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Bne3D.Editor
{
    public static class BneBuild
    {
        public const string ScenePath="Assets/Scenes/Bne3D.unity";
        [MenuItem("BNE/Prepare project")]
        public static void Configure()
        {
            if(!File.Exists(ScenePath))
            {
                Directory.CreateDirectory("Assets/Scenes");
                var current=SceneManager.GetActiveScene();
                // Unity starts batch mode with an untitled scene; save that scene directly.
                if(current.IsValid() && string.IsNullOrEmpty(current.path))
                    EditorSceneManager.SaveScene(current,ScenePath);
                else
                {
                    var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Additive);
                    EditorSceneManager.SaveScene(scene,ScenePath);EditorSceneManager.CloseScene(scene,true);
                    if(current.IsValid())SceneManager.SetActiveScene(current);
                }
            }
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(ScenePath,true)};
            PlayerSettings.companyName="Dr Joshua Rasera";PlayerSettings.productName="Shake the bed — 3D";PlayerSettings.bundleVersion="0.1.0";
            PlayerSettings.defaultScreenWidth=1280;PlayerSettings.defaultScreenHeight=800;
            PlayerSettings.colorSpace=ColorSpace.Linear;PlayerSettings.runInBackground=false;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.WebGL,ScriptingImplementation.IL2CPP);
            PlayerSettings.WebGL.template="PROJECT:BneSite";
            PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback=true;
            PlayerSettings.WebGL.dataCaching=true;
            PlayerSettings.WebGL.exceptionSupport=WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            AssetDatabase.SaveAssets();
        }
        [MenuItem("BNE/Validate and build Web")]
        public static void ValidateAndBuildWeb()
        {
            Configure();BneSmoke.Run();BuildWeb();
        }
        [MenuItem("BNE/Build Web")]
        public static void BuildWeb()
        {
            Configure();string project=Directory.GetParent(Application.dataPath).FullName;
            string output=Environment.GetEnvironmentVariable("BNE_WEB_OUTPUT");
            if(string.IsNullOrEmpty(output))output=Path.GetFullPath(Path.Combine(project,"../../applets/bne-3d"));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath},locationPathName=output,target=BuildTarget.WebGL,options=BuildOptions.None});
            if(report.summary.result!=BuildResult.Succeeded)throw new Exception("Unity Web build failed: "+report.summary.result);
            Debug.Log("BNE_WEB_BUILD_OK "+output+" ("+report.summary.totalSize+" bytes)");
        }
    }
}
