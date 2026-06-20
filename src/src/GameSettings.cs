using Godot;
using System;

public static class GameSettings
{
    public static int SelectedJoypadId = -1; // -1 means All/Auto
    public static string LevelToLoad = "res://scenes/levels/level_01.tscn";
    public static string Language = "pt"; // "pt" (default) or "en"

    // Music volume (0..1 linear), routed through a dedicated "Music" audio bus.
    public static float MusicVolume = 0.6f;

    // Sound theme selection: "procedural" or a theme name scanned from res://audio/effects/ (e.g., "Menu_Sounds_V2_Minimalistic")
    public static string SoundTheme = "procedural";

    // Loads a sound effect. Prefers the imported resource, but falls back to reading the
    // raw .wav file directly and parsing its PCM data.
    public static AudioStream? LoadSFX(string path)
    {
        if (ResourceLoader.Exists(path))
        {
            var res = GD.Load<AudioStream>(path);
            if (res != null) return res;
        }

        if (path.EndsWith(".wav", StringComparison.OrdinalIgnoreCase) && Godot.FileAccess.FileExists(path))
        {
            using var f = Godot.FileAccess.Open(path, Godot.FileAccess.ModeFlags.Read);
            if (f != null)
            {
                byte[] bytes = f.GetBuffer((long)f.GetLength());
                if (bytes.Length > 44)
                {
                    string riff = System.Text.Encoding.ASCII.GetString(bytes, 0, 4);
                    string wave = System.Text.Encoding.ASCII.GetString(bytes, 8, 4);
                    if (riff == "RIFF" && wave == "WAVE")
                    {
                        int pos = 12;
                        ushort format = 1;
                        ushort channels = 1;
                        uint sampleRate = 44100;
                        ushort bitsPerSample = 16;
                        byte[] data = Array.Empty<byte>();

                        while (pos + 8 <= bytes.Length)
                        {
                            string chunkId = System.Text.Encoding.ASCII.GetString(bytes, pos, 4);
                            uint chunkSize = BitConverter.ToUInt32(bytes, pos + 4);
                            pos += 8;

                            if (chunkId == "fmt ")
                            {
                                if (pos + 16 <= bytes.Length)
                                {
                                    format = BitConverter.ToUInt16(bytes, pos);
                                    channels = BitConverter.ToUInt16(bytes, pos + 2);
                                    sampleRate = BitConverter.ToUInt32(bytes, pos + 4);
                                    bitsPerSample = BitConverter.ToUInt16(bytes, pos + 14);
                                }
                            }
                            else if (chunkId == "data")
                            {
                                data = new byte[chunkSize];
                                Array.Copy(bytes, pos, data, 0, Math.Min(chunkSize, bytes.Length - pos));
                                break;
                            }
                            pos += (int)chunkSize;
                        }

                        if (data.Length > 0)
                        {
                            var wavStream = new AudioStreamWav();
                            wavStream.Data = data;
                            wavStream.Format = bitsPerSample == 8 ? AudioStreamWav.FormatEnum.Format8Bits : AudioStreamWav.FormatEnum.Format16Bits;
                            wavStream.LoopMode = AudioStreamWav.LoopModeEnum.Disabled;
                            wavStream.MixRate = (int)sampleRate;
                            wavStream.Stereo = channels == 2;
                            return wavStream;
                        }
                    }
                }
            }
        }

        GD.PrintErr($"[GameSettings] Could not load SFX: {path}");
        return null;
    }

    // Scans res://audio/effects/ for wav files to detect sound themes dynamically.
    public static System.Collections.Generic.List<string> GetAvailableSoundThemes()
    {
        var themes = new System.Collections.Generic.List<string> { "procedural" };
        using var dir = DirAccess.Open("res://audio/effects/");
        if (dir != null)
        {
            dir.ListDirBegin();
            string fileName = dir.GetNext();
            while (fileName != "")
            {
                if (!dir.CurrentIsDir() && fileName.EndsWith(".wav") && fileName.StartsWith("Menu_Sounds_"))
                {
                    int lastUnderscore = fileName.LastIndexOf('_');
                    if (lastUnderscore > 12)
                    {
                        string themePrefix = fileName.Substring(0, lastUnderscore);
                        if (!themes.Contains(themePrefix))
                        {
                            themes.Add(themePrefix);
                        }
                    }
                }
                fileName = dir.GetNext();
            }
        }
        return themes;
    }

    // Translates the theme name for display in option button.
    public static string GetThemeDisplayName(string theme, bool isPt)
    {
        if (theme == "procedural")
        {
            return isPt ? "Sintético (Retro)" : "Synthetic (Retro)";
        }
        if (theme == "Menu_Sounds_V2_Minimalistic")
        {
            return isPt ? "Minimalista V2" : "Minimalist V2";
        }
        string name = theme;
        if (name.StartsWith("Menu_Sounds_"))
        {
            name = name.Substring("Menu_Sounds_".Length);
        }
        return name.Replace('_', ' ');
    }

    // Loads a music track. Prefers the imported resource, but falls back to reading the
    // raw file directly so it works even when the .mp3 has no .import sidecar yet.
    public static AudioStream? LoadMusic(string path)
    {
        if (ResourceLoader.Exists(path))
        {
            var res = GD.Load<AudioStream>(path);
            if (res != null) return res;
        }

        if (path.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase) && Godot.FileAccess.FileExists(path))
        {
            using var f = Godot.FileAccess.Open(path, Godot.FileAccess.ModeFlags.Read);
            if (f != null)
            {
                var mp3 = new AudioStreamMP3();
                mp3.Data = f.GetBuffer((long)f.GetLength());
                return mp3;
            }
        }

        GD.PrintErr($"[GameSettings] Could not load music: {path}");
        return null;
    }

    // Creates the "Music" audio bus at runtime if it doesn't exist yet and applies
    // the current MusicVolume. Music players should set Bus = "Music".
    public static void EnsureMusicBus()
    {
        if (AudioServer.GetBusIndex("Music") == -1)
        {
            AudioServer.AddBus();
            int idx = AudioServer.BusCount - 1;
            AudioServer.SetBusName(idx, "Music");
            AudioServer.SetBusSend(idx, "Master");
        }
        ApplyMusicVolume();
    }

    // Applies MusicVolume to the "Music" bus. Mutes the bus at (near) zero to avoid
    // -inf dB artifacts.
    public static void ApplyMusicVolume()
    {
        int idx = AudioServer.GetBusIndex("Music");
        if (idx == -1) return;

        if (MusicVolume <= 0.0001f)
        {
            AudioServer.SetBusMute(idx, true);
        }
        else
        {
            AudioServer.SetBusMute(idx, false);
            AudioServer.SetBusVolumeDb(idx, Mathf.LinearToDb(MusicVolume));
        }
    }

    public static void ApplyJoypadSettings()
    {
        // Get all custom and built-in actions in the InputMap
        var actions = InputMap.GetActions();
        foreach (var action in actions)
        {
            var events = InputMap.ActionGetEvents(action);
            foreach (var ev in events)
            {
                // Filter joypad buttons and motion events
                if (ev is InputEventJoypadButton joyBtn)
                {
                    joyBtn.Device = SelectedJoypadId;
                }
                else if (ev is InputEventJoypadMotion joyMotion)
                {
                    joyMotion.Device = SelectedJoypadId;
                }
            }
        }
        
        // Also pre-map common buttons to ensure immediate out-of-the-box compatibility
        PreMapDefaultButtons();
        
        GD.Print($"[GameSettings] Applied joypad device ID: {SelectedJoypadId}");
    }

    private static void PreMapDefaultButtons()
    {
        // Add common joypad buttons (0=A/Cross, 1=B/Circle, 2=X/Square, 3=Y/Triangle, 6=Start)
        // to "ui_accept" and "jump" to ensure standard USB gamepads work immediately.
        int[] commonButtons = new int[] { 0, 1, 2, 3, 6 };
        string[] actions = new string[] { "ui_accept", "jump" };
        
        foreach (var action in actions)
        {
            // Ensure the action exists in InputMap
            if (!InputMap.HasAction(action)) continue;

            foreach (var btnId in commonButtons)
            {
                bool exists = false;
                var events = InputMap.ActionGetEvents(action);
                foreach (var ev in events)
                {
                    if (ev is InputEventJoypadButton jb && (int)jb.ButtonIndex == btnId && jb.Device == SelectedJoypadId)
                    {
                        exists = true;
                        break;
                    }
                }
                
                if (!exists)
                {
                    var newEvent = new InputEventJoypadButton();
                    newEvent.Device = SelectedJoypadId;
                    newEvent.ButtonIndex = (JoyButton)btnId;
                    InputMap.ActionAddEvent(action, newEvent);
                }
            }
        }
    }

    private static readonly System.Net.Http.HttpClient _telemetryClient = new System.Net.Http.HttpClient();

    public static void FinalizeTelemetry()
    {
        string? telemetryUrl = null;
        foreach (var arg in OS.GetCmdlineUserArgs())
        {
            if (arg.StartsWith("--telemetry="))
            {
                telemetryUrl = arg.Substring("--telemetry=".Length).Trim().TrimEnd('/') + "/api/telemetry";
                break;
            }
            if (arg == "--telemetry")
            {
                telemetryUrl = "http://127.0.0.1:8000/api/telemetry";
                break;
            }
        }

        if (!string.IsNullOrEmpty(telemetryUrl))
        {
            try
            {
                GD.Print($"[GameSettings] Finalizing telemetry at: {telemetryUrl}");
                var content = new System.Net.Http.StringContent("{\"exit\":true}", System.Text.Encoding.UTF8, "application/json");
                var task = _telemetryClient.PostAsync(telemetryUrl, content);
                task.Wait(1000); // Wait up to 1 second
            }
            catch (Exception ex)
            {
                GD.PrintErr($"[GameSettings] Error finalizing telemetry: {ex.Message}");
            }
        }
    }
}
