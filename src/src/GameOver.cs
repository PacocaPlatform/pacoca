using Godot;
using System;

public partial class GameOver : Control
{
    private AudioStreamPlayer _audioPlayer = null!;
    private AudioStreamGeneratorPlayback? _audioPlayback;
    private AudioStreamPlayer _sfxWavPlayer = null!;
    private double _timer = 0.0;
    private const double TotalWaitTime = 4.5;
    private bool _transitioning = false;

    public override void _Ready()
    {
        // Setup WAV sound player
        _sfxWavPlayer = new AudioStreamPlayer();
        _sfxWavPlayer.Bus = "Master";
        AddChild(_sfxWavPlayer);

        // Setup procedural audio player for the Game Over sound
        _audioPlayer = new AudioStreamPlayer();
        AddChild(_audioPlayer);
        var generator = new AudioStreamGenerator();
        generator.MixRate = 44100.0f;
        generator.BufferLength = 0.1f;
        _audioPlayer.Stream = generator;
        _audioPlayer.Play();
        _audioPlayback = _audioPlayer.GetStreamPlayback() as AudioStreamGeneratorPlayback;

        // Play the Game Over tune
        PlayGameOverTune();

        // Translate UI
        TranslateUI();

        // Connect theme/UI animations or elements
        var panel = GetNodeOrNull<PanelContainer>("MarginContainer/PanelContainer");
        if (panel != null)
        {
            panel.PivotOffset = panel.Size / 2;
            panel.Scale = new Vector2(0.5f, 0.5f);
            panel.Modulate = new Color(1, 1, 1, 0);

            // Pop-in tween
            var tween = CreateTween().SetParallel(true);
            tween.TweenProperty(panel, "scale", Vector2.One, 0.5)
                 .SetTrans(Tween.TransitionType.Back)
                 .SetEase(Tween.EaseType.Out);
            tween.TweenProperty(panel, "modulate", new Color(1, 1, 1, 1), 0.4);
        }
    }

    private void TranslateUI()
    {
        bool isPt = GameSettings.Language == "pt";
        GetNode<Label>("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/DescriptionLabel").Text = isPt 
            ? "Suas vidas acabaram!" 
            : "You ran out of lives!";
        GetNode<Label>("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/HintLabel").Text = isPt 
            ? "Pressione qualquer botão para voltar ao menu" 
            : "Press any button to return to the menu";
    }

    public override void _Process(double delta)
    {
        _timer += delta;

        // Automatically transition to the Main Menu after timer expires
        if (_timer >= TotalWaitTime && !_transitioning)
        {
            GoToMainMenu();
        }
    }

    public override void _Input(InputEvent @event)
    {
        // Pressing jump, ui_accept or mouse click goes to Main Menu instantly
        if ((@event.IsActionPressed("jump") || @event.IsActionPressed("ui_accept") || 
             (@event is InputEventMouseButton mb && mb.Pressed)) && !_transitioning && _timer > 0.5)
        {
            GoToMainMenu();
        }
    }

    private void GoToMainMenu()
    {
        _transitioning = true;
        // Play simple click feedback
        PlayMenuSound("forward", 440.0f, 0.15f, 0.3f);
        
        // Tween fade out before changing scene
        var panel = GetNodeOrNull<PanelContainer>("MarginContainer/PanelContainer");
        if (panel != null)
        {
            var tween = CreateTween();
            tween.TweenProperty(panel, "modulate", new Color(1, 1, 1, 0), 0.3);
            tween.TweenCallback(Callable.From(() => {
                GetTree().ChangeSceneToFile("res://scenes/menu.tscn");
            }));
        }
        else
        {
            GetTree().ChangeSceneToFile("res://scenes/menu.tscn");
        }
    }

    private async void PlayGameOverTune()
    {
        // Sad retro descending jingle:
        // C5 (523.25Hz), B4 (493.88Hz), A4 (440.00Hz), G#4 (415.30Hz), G4 (392.00Hz), F4 (349.23Hz), E4 (329.63Hz)
        float[] notes = { 523.25f, 493.88f, 440.00f, 415.30f, 392.00f, 349.23f, 329.63f, 261.63f };
        float[] durations = { 0.2f, 0.2f, 0.2f, 0.2f, 0.3f, 0.3f, 0.4f, 0.6f };
        float[] volumes = { 0.4f, 0.4f, 0.4f, 0.4f, 0.4f, 0.4f, 0.4f, 0.5f };

        for (int i = 0; i < notes.Length; i++)
        {
            if (_transitioning) break;
            PlaySound(notes[i], durations[i], volumes[i]);
            await ToSignal(GetTree().CreateTimer(durations[i] * 0.9f), SceneTreeTimer.SignalName.Timeout);
        }
    }

    // Plays a menu sound based on the selected audio theme
    private void PlayMenuSound(string eventName, float fallbackFreq, float fallbackDuration, float fallbackVolume = 0.5f)
    {
        if (GameSettings.SoundTheme == "procedural" || string.IsNullOrEmpty(GameSettings.SoundTheme))
        {
            PlaySound(fallbackFreq, fallbackDuration, fallbackVolume);
        }
        else
        {
            string path = $"res://audio/effects/{GameSettings.SoundTheme}_{eventName.ToUpper()}.wav";
            var stream = GameSettings.LoadSFX(path);
            if (stream != null)
            {
                _sfxWavPlayer.Stream = stream;
                _sfxWavPlayer.Play();
            }
            else
            {
                PlaySound(fallbackFreq, fallbackDuration, fallbackVolume);
            }
        }
    }

    private void PlaySound(float frequency, float duration, float volume)
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
                // Fade out envelope per note
                float envelope = (float)(numSamples - i) / numSamples;
                float sample = Mathf.Sin(phase) * volume * envelope;
                _audioPlayback.PushFrame(new Vector2(sample, sample));
                phase += phaseIncrement;
            }
        }
    }
}
