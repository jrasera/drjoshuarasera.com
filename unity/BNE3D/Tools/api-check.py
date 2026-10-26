#!/usr/bin/env python3
"""Compile against installed Unity APIs without starting the Editor.
This checks C# syntax/API compatibility only; it does not run Unity or validate physics.
"""
from pathlib import Path
import argparse, subprocess, sys
parser=argparse.ArgumentParser()
parser.add_argument('--editor',default='/Applications/Unity/Hub/Editor/6000.3.10f1/Unity.app')
args=parser.parse_args()
project=Path(__file__).resolve().parents[1]
resources=Path(args.editor)/'Contents/Resources/Scripting'
refs=list((resources/'UnityReferenceAssemblies/unity-4.8-api').glob('*.dll'))
refs+=list((resources/'UnityReferenceAssemblies/unity-4.8-api/Facades').glob('*.dll'))
managed=resources/'Managed'
refs+=list((managed/'UnityEngine').glob('Unity*.dll'))
# Module assemblies define the API; aggregate assemblies duplicate these types.
refs=list({p.name:p for p in refs}.values())
output=project/'Builds/api-check';output.mkdir(parents=True,exist_ok=True)
for name,defines,source in [('editor','UNITY_EDITOR;UNITY_EDITOR_OSX',list((project/'Assets/Scripts').glob('*.cs'))+list((project/'Assets/Editor').glob('*.cs'))),('web','UNITY_WEBGL',list((project/'Assets/Scripts').glob('*.cs')))]:
    lines=['-nologo','-target:library','-langversion:9.0','-nostdlib+','-define:'+defines,'-out:"'+str(output/(name+'.dll'))+'"']
    target_refs=list(refs)
    if name=='web':
        web_module=Path(args.editor).parent/'PlaybackEngines/WebGLSupport/Managed/UnityEngine.WebGLModule.dll'
        if not web_module.exists():
            sys.exit('Install Web Build Support to check WebGL-only APIs.')
        target_refs.append(web_module)
    lines+=['-r:"'+str(p)+'"' for p in target_refs]
    lines+=['"'+str(p)+'"' for p in source]
    response=output/(name+'.rsp');response.write_text('\n'.join(lines)+'\n')
    result=subprocess.run([str(resources/'NetCoreRuntime/dotnet'),str(resources/'DotNetSdkRoslyn/csc.dll'),'@'+str(response)])
    if result.returncode:sys.exit(result.returncode)
    print('Unity '+name+' C# API check passed')
