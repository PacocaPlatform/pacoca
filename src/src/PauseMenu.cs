using Godot;
using System;

public partial class PauseMenu : Control
{
    private Button _resumeButton = null!;
    private Button _mainMenuButton = null!;
    private Button _exitButton = null!;

    // Procedural sound effects player
    private AudioStreamPlayer _audioPlayer = null!;
    private AudioStreamGeneratorPlayback? _audioPlayback;

    public override void _Ready()
    {
        // Set process mode to Always so this node runs even when the game is paused
        ProcessMode = ProcessModeEnum.Always;

        // Setup procedural audio player
        _audioPlayer = new AudioStreamPlayer();
        AddChild(_audioPlayer);
        var generator = new AudioStreamGenerator();
        generator.MixRate = 44100.0f;
        generator.BufferLength = 0.1f;
        _audioPlayer.Stream = generator;
        _audioPlayer.Play();
        _audioPlayback = _audioPlayer.GetStreamPlayback() as AudioStreamGeneratorPlayback;

        // Fetch button references
        _resumeButton = GetNode<Button>("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/ResumeButton");
        _mainMenuButton = GetNode<Button>("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/MainMenuButton");
        _exitButton = GetNode<Button>("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/ExitButton");

        // Connect button signals
        _resumeButton.Pressed += OnResumePressed;
        _mainMenuButton.Pressed += OnMainMenuPressed;
        _exitButton.Pressed += OnExitPressed;

        // Hide pause menu by default
        Visible = false;

        // Connect procedural sound feedback recursively
        ConnectUIFeedback(this);
    }

    private void ConnectUIFeedback(Node node)
    {
        if (node is Button btn)
        {
            // Play short tick when focused
            btn.FocusEntered += () => PlaySound(880f, 0.03f, 0.1f);
            
            // Hover automatically grabs focus
            btn.MouseEntered += () => {
                if (Visible && !btn.Disabled)
                    btn.GrabFocus();
            };
        }

        foreach (Node child in node.GetChildren())
        {
            ConnectUIFeedback(child);
        }
    }

    public override void _Input(InputEvent @event)
    {
        if (@event.IsActionPressed("pause"))
        {
            // Consume input to prevent double triggering
            GetViewport().SetInputAsHandled();

            if (Visible)
            {
                OnResumePressed();
            }
            else
            {
                PauseGame();
            }
        }
    }

    private void PauseGame()
    {
        // Pause the SceneTree (freezes physics, players, enemies, items)
        GetTree().Paused = true;
        Visible = true;

        // Focus the resume button immediately for joystick/keyboard navigation
        _resumeButton.GrabFocus();

        PlaySound(523.25f, 0.15f, 0.4f); // Pause chime (C5)
    }

    private void OnResumePressed()
    {
        // Resume/Unpause the SceneTree
        GetTree().Paused = false;
        Visible = false;

        PlaySound(783.99f, 0.1f, 0.4f); // Resume chime (G5)
    }

    private void OnMainMenuPressed()
    {
        PlaySound(392.00f, 0.1f, 0.3f); // Back chime (G4)
        
        // CRITICAL: Unpause the tree before changing scene, or else the target scene will start paused!
        GetTree().Paused = false;
        
        GetTree().ChangeSceneToFile("res://scenes/menu.tscn");
    }

    private void OnExitPressed()
    {
        PlaySound(261.63f, 0.2f, 0.3f); // Quit chime (C4)
        GetTree().CreateTimer(0.25f).Timeout += () => GetTree().Quit();
    }

    // Procedural sound helper
    public void PlaySound(float frequency, float duration, float volume = 0.5f)
    {
        if (_audioPlayback == null) return;

        float sampleRate = 44100.0f;
        int numSamples = (int)(sampleRate * duration);
        float phase = 0.0f;
        float phaseIncrement = (2.0f * Mathf.Pi * frequency) / sampleRate;

        for (int i = 0; i < numSamples; i++)
        {
            if (_audioPlayback.GetFramesAvailable() > 0)
            {
                float envelope = (float)(numSamples - i) / numSamples;
                float sample = Mathf.Sin(phase) * volume * envelope;
                _audioPlayback.PushFrame(new Vector2(sample, sample));
                phase += phaseIncrement;
            }
        }
    }
}
