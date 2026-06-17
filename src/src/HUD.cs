using Godot;
using System;

public partial class HUD : Control
{
    private Label _scoreLabel = null!;
    private Label _timeLabel = null!;
    private Label _ringsLabel = null!;
    private Label _livesLabel = null!;
    private Label _speedLabel = null!;
    private PanelContainer _statsPanel = null!;
    
    private Player? _player;
    private float _blinkTimer = 0.0f;
    private bool _ringsBlinkRed = false;

    public override void _Ready()
    {
        _scoreLabel = GetNode<Label>("MarginContainer/StatsPanel/MarginContainer/VBoxContainer/ScoreLabel");
        _timeLabel = GetNode<Label>("MarginContainer/StatsPanel/MarginContainer/VBoxContainer/TimeLabel");
        _ringsLabel = GetNode<Label>("MarginContainer/StatsPanel/MarginContainer/VBoxContainer/RingsLabel");
        _livesLabel = GetNode<Label>("MarginContainer/StatsPanel/MarginContainer/VBoxContainer/LivesLabel");
        _speedLabel = GetNode<Label>("MarginContainer/SpeedPanel/MarginContainer/SpeedLabel");
        _statsPanel = GetNode<PanelContainer>("MarginContainer/StatsPanel");

        // Find the player node in the scene
        _player = GetTree().Root.FindChild("Player", true, false) as Player;
        if (_player != null)
        {
            // Connect to stats signal
            _player.PlayerStatsChanged += OnPlayerStatsChanged;
        }
    }

    public override void _Process(double delta)
    {
        // Update time directly
        if (_player != null)
        {
            double elapsed = _player.TimeElapsed;
            int minutes = (int)(elapsed / 60);
            int seconds = (int)(elapsed % 60);
            int centiseconds = (int)((elapsed * 100) % 100);
            _timeLabel.Text = $"TIME  {minutes:00}:{seconds:00}:{centiseconds:00}";
        }

        // Blinking Rings label when rings are zero
        if (_player != null && _player.Rings == 0)
        {
            _blinkTimer += (float)delta;
            if (_blinkTimer >= 0.25f)
            {
                _blinkTimer = 0.0f;
                _ringsBlinkRed = !_ringsBlinkRed;
                _ringsLabel.AddThemeColorOverride("font_color", _ringsBlinkRed ? new Color(1.0f, 0.2f, 0.2f) : new Color(1.0f, 0.9f, 0.0f));
            }
        }
        else
        {
            _ringsLabel.AddThemeColorOverride("font_color", new Color(1.0f, 0.9f, 0.0f)); // Gold color when has rings
        }
    }

    private void OnPlayerStatsChanged(int rings, int score, float speed, int lives)
    {
        _scoreLabel.Text = $"SCORE {score:000000}";
        _ringsLabel.Text = $"MOEDAS {rings:000}";
        _livesLabel.Text = $"VIDAS {lives}";
        // Speed in km/h or m/s
        float speedKmh = speed * 3.6f;
        _speedLabel.Text = $"{speedKmh:F1} km/h";

        // Bounce effect on ring collect
        if (rings > 0)
        {
            Tween tween = CreateTween().SetTrans(Tween.TransitionType.Back).SetEase(Tween.EaseType.Out);
            tween.TweenProperty(_ringsLabel, "scale", new Vector2(1.2f, 1.2f), 0.05);
            tween.TweenProperty(_ringsLabel, "scale", Vector2.One, 0.15);
        }
    }
}
