using Godot;
using System;

public static class GameSettings
{
    public static int SelectedJoypadId = -1; // -1 means All/Auto
    public static string LevelToLoad = "res://scenes/levels/level_01.tscn";

    // Music volume (0..1 linear), routed through a dedicated "Music" audio bus.
    public static float MusicVolume = 0.6f;

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
}
