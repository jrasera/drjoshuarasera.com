Shader "BNE/Grain"
{
    Properties { _Color ("Colour", Color) = (0.57,0.74,0.79,1) _CutExempt ("Keep whole in cutaway", Float) = 0 }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            float4 _Color, _BneCutPlane;
            float _BneCutEnabled, _CutExempt;
            struct appdata { float4 vertex:POSITION; float3 normal:NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos:SV_POSITION; float3 normal:TEXCOORD0; float3 world:TEXCOORD1; UNITY_VERTEX_OUTPUT_STEREO };
            v2f vert(appdata v) { v2f o; UNITY_SETUP_INSTANCE_ID(v); UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o); o.pos=UnityObjectToClipPos(v.vertex);o.world=mul(unity_ObjectToWorld,v.vertex).xyz;o.normal=UnityObjectToWorldNormal(v.normal);return o; }
            fixed4 frag(v2f i):SV_Target
            {
                if(_BneCutEnabled>.5 && _CutExempt<.5)clip(-dot(float4(i.world,1),_BneCutPlane));
                float3 n=normalize(i.normal), light=normalize(float3(-.4,.8,-.6));
                float diffuse=.32+.68*max(0,dot(n,light));
                float spec=pow(max(0,dot(reflect(-light,n),normalize(_WorldSpaceCameraPos-i.world))),32)*.22;
                return fixed4(_Color.rgb*diffuse+spec,1);
            }
            ENDCG
        }
    }
}
