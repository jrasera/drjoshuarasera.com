using System;
using UnityEngine;

namespace Bne3D
{
    [Serializable]
    public sealed class BneSettings
    {
        public bool singleIntruder = false;
        public bool layered = false;
        public bool compact = true;
        public int smallCount = 750, largeCount = 20, seed = 87413;
        public float smallMin = .5f, smallMax = .75f, largeMin = 1.7f, largeMax = 2.1f, intruderRatio = 3f;
        public float diameter = 10f, height = 60f, frequency = 15f, amplitude = 1.5f, duration = 10f;
        public float grainFriction = .46630766f, wallFriction = .46630766f, bounce = 0f, densityRatio = 1f;
        public int quality = 0;
        public int LargeCount => singleIntruder ? 1 : largeCount;
        public float Gamma => amplitude * .001f * Mathf.Pow(2f * Mathf.PI * frequency, 2) / 9.81f;
        public float Timestep => 1f / Mathf.Max(quality == 0 ? 600f : quality == 1 ? 2400f : 4800f, frequency * (quality == 0 ? 60f : quality == 1 ? 240f : 480f));
        public float SettlingDuration => compact ? .12f : 2f;
        public BneSettings Copy() => JsonUtility.FromJson<BneSettings>(JsonUtility.ToJson(this));
        public string Validate()
        {
            foreach (float v in new[] {smallMin,smallMax,largeMin,largeMax,intruderRatio,diameter,height,frequency,amplitude,duration,grainFriction,wallFriction,bounce,densityRatio})
                if (float.IsNaN(v) || float.IsInfinity(v)) return "Use finite numerical settings.";
            if (smallCount < 10 || LargeCount < 1 || smallCount + LargeCount > 5000) return "Use 10 or more small grains and at most 5,000 grains in total.";
            if (smallMin < .2f || smallMax < smallMin || smallMax > 10 || largeMin < .2f || largeMax < largeMin || largeMax > 40 || intruderRatio < 1 || intruderRatio > 10) return "Check the particle diameter ranges (millimetres).";
            if (diameter < 9 || diameter > 100 || height < 20 || height > 300) return "Vial diameter must be 9–100 mm and height 20–300 mm.";
            if (frequency < 0 || frequency > 150 || amplitude < 0 || amplitude > 3 || duration < .5f || duration > 60) return "Use 0–150 Hz, 0–3 mm amplitude and 0.5–60 s shaking time.";
            if (grainFriction < 0 || grainFriction > 1 || wallFriction < 0 || wallFriction > 1 || bounce < 0 || bounce > 1 || densityRatio < .5f || densityRatio > 3) return "Check friction, bounce and density ratio.";
            if (quality < 0 || quality > 2) return "Choose a valid physics quality.";
            return null;
        }
        public static BneSettings BuriedIntruder() => new BneSettings { singleIntruder=true,layered=true,smallCount=400,smallMin=.95f,smallMax=1.05f,intruderRatio=3,diameter=9,height=60,frequency=20,amplitude=1.5f,duration=3 };
        public static BneSettings QuickSlice(int condition = 8) => new BneSettings { duration=3, smallCount=250, largeCount=20, diameter=9, height=100, amplitude=condition==7?1:1.5f };
        public static BneSettings PaperPreview(int condition = 8) => new BneSettings { smallCount=600,largeCount=10,diameter=9,height=100,duration=3,amplitude=condition==7?1:1.5f };
        // Uniform bounds approximate the fractions, not the measured distribution.
        public static BneSettings PaperMixture(int condition = 8) => new BneSettings { smallCount=4000, largeCount=70, diameter=9, height=100, amplitude=condition==7?1:1.5f };
    }

    [Serializable]
    public struct BneSample
    {
        public float time, large, small, largeCom, smallCom, largeMassFraction, bedHeight;
        public float aboveQuarter, aboveHalf, aboveThreeQuarters;
        public float separation => large-small;
    }

    [Serializable]
    public struct BnePoint { public float time, large, small, largeCom, smallCom; }
}
