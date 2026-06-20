using Godot;
using System;

public partial class LevelFinishScreen : Control
{
    private Label _scoreLabel = null!;
    private Label _ringsLabel = null!;
    private Label _timeLabel = null!;
    private Button _continueButton = null!;

    // Procedural sound effects player
    private AudioStreamPlayer _audioPlayer = null!;
    private AudioStreamGeneratorPlayback? _audioPlayback;
    private AudioStreamPlayer _sfxWavPlayer = null!;

    private bool _transitioning = false;

    public override void _Ready()
    {
        // Fetch label and button references using scene unique names
        _scoreLabel = GetNode<Label>("%ScoreValueLabel");
        _ringsLabel = GetNode<Label>("%RingsValueLabel");
        _timeLabel = GetNode<Label>("%TimeValueLabel");
        _continueButton = GetNode<Button>("%ContinueButton");

        // Connect button signal
        _continueButton.Pressed += OnContinuePressed;

        // Setup WAV sound player
        _sfxWavPlayer = new AudioStreamPlayer();
        _sfxWavPlayer.Bus = "Master";
        AddChild(_sfxWavPlayer);

        // Setup procedural audio player
        _audioPlayer = new AudioStreamPlayer();
        AddChild(_audioPlayer);
        var generator = new AudioStreamGenerator();
        generator.MixRate = 44100.0f;
        generator.BufferLength = 0.1f;
        _audioPlayer.Stream = generator;
        _audioPlayer.Play();
        _audioPlayback = _audioPlayer.GetStreamPlayback() as AudioStreamGeneratorPlayback;

        // Hide screen by default
        Visible = false;

        // Connect procedural sound feedback recursively
        ConnectUIFeedback(this);
    }

    private void ConnectUIFeedback(Node node)
    {
        if (node is Button btn)
        {
            // Play short tick when focused
            btn.FocusEntered += () => PlayMenuSound("hover", 880f, 0.03f, 0.1f);
            
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

    public void ShowScreen(int rings, int score, double timeElapsed)
    {
        Visible = true;
        
        // Translate UI elements dynamically
        TranslateUI();

        // Format stats
        _ringsLabel.Text = $"{rings:000}";
        _scoreLabel.Text = $"{score:000000000}";
        
        int minutes = (int)(timeElapsed / 60);
        int seconds = (int)(timeElapsed % 60);
        int centiseconds = (int)((timeElapsed * 100) % 100);
        _timeLabel.Text = $"{minutes}' {seconds:00}\" {centiseconds:00}";

        // Focus the continue button for keyboard/gamepad navigation
        _continueButton.GrabFocus();

        // Pop-in animation for the panel
        var panel = GetNodeOrNull<PanelContainer>("MarginContainer/PanelContainer");
        if (panel != null)
        {
            panel.PivotOffset = panel.Size / 2;
            panel.Scale = new Vector2(0.8f, 0.8f);
            panel.Modulate = new Color(1, 1, 1, 0);

            var tween = CreateTween().SetParallel(true);
            tween.TweenProperty(panel, "scale", Vector2.One, 0.4)
                 .SetTrans(Tween.TransitionType.Back)
                 .SetEase(Tween.EaseType.Out);
            tween.TweenProperty(panel, "modulate", new Color(1, 1, 1, 1), 0.35);
        }
    }

    private void TranslateUI()
    {
        bool isPt = GameSettings.Language == "pt";
        GetNode<Label>("MarginContainer/PanelContainer/Margin/VBox/Title").Text = isPt ? "NÍVEL CONCLUÍDO!" : "LEVEL COMPLETED!";
        GetNode<Label>("MarginContainer/PanelContainer/Margin/VBox/StatsGrid/ScoreName").Text = isPt ? "PONTOS" : "SCORE";
        GetNode<Label>("MarginContainer/PanelContainer/Margin/VBox/StatsGrid/RingsName").Text = isPt ? "MOEDAS" : "RINGS";
        GetNode<Label>("MarginContainer/PanelContainer/Margin/VBox/StatsGrid/TimeName").Text = isPt ? "TEMPO" : "TIME";
        _continueButton.Text = isPt ? "CONTINUAR" : "CONTINUE";
    }

    private void OnContinuePressed()
    {
        if (_transitioning) return;
        _transitioning = true;

        PlayMenuSound("forward", 1046.50f, 0.15f, 0.4f); // Victory confirm chime

        // Detach statistics and load next scene
        string currentLevel = GameSettings.LevelToLoad;
        string nextLevel = "res://scenes/menu.tscn";

        if (currentLevel.Contains("_01.tscn"))
        {
            nextLevel = currentLevel.Replace("_01.tscn", "_02.tscn");
        }
        else if (currentLevel.Contains("_02.tscn"))
        {
            nextLevel = currentLevel.Replace("_02.tscn", "_03.tscn");
        }
        else if (currentLevel.Contains("_03.tscn"))
        {
            nextLevel = currentLevel.Replace("_03.tscn", "_04.tscn");
        }

        // Wait brief moment for the click sound before changing scene
        GetTree().CreateTimer(0.2f).Timeout += () =>
        {
            if (nextLevel == "res://scenes/menu.tscn")
            {
                GetTree().ChangeSceneToFile("res://scenes/menu.tscn");
            }
            else
            {
                GameSettings.LevelToLoad = nextLevel;
                GetTree().ChangeSceneToFile("res://scenes/main.tscn");
            }
        };
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
