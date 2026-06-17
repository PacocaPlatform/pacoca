using Godot;
using System;

public static class GameSettings
{
    public static int SelectedJoypadId = -1; // -1 means All/Auto
    public static string LevelToLoad = "res://scenes/levels/level_01.tscn";

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
