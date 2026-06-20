using Godot;
using System;

public partial class HUD : Control
{
    private Label _scoreLabel = null!;
    private Label _timeLabel = null!;
    private Label _ringsLabel = null!;
    private Label _livesLabel = null!;
    private Label _speedLabel = null!;
    
    private Player? _player;
    private float _blinkTimer = 0.0f;
    private bool _ringsBlinkRed = false;

    public override void _Ready()
    {
        // Bind to nodes using Scene Unique Names (%) to prevent path breakage
        _scoreLabel = GetNode<Label>("%ScoreValueLabel");
        _timeLabel = GetNode<Label>("%TimeValueLabel");
        _ringsLabel = GetNode<Label>("%RingsLabel");
        _livesLabel = GetNode<Label>("%LivesLabel");
        _speedLabel = GetNode<Label>("%SpeedLabel");

        // Find the player node in the scene
        _player = GetTree().Root.FindChild("Player", true, false) as Player;
        if (_player != null)
        {
            // Connect to stats signal
            _player.PlayerStatsChanged += OnPlayerStatsChanged;
            
            // Initial call to setup stats
            OnPlayerStatsChanged(_player.Rings, _player.Score, _player.Velocity.Length(), _player.Lives);
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
            
            // Format time as 0' 13" 71 like Sonic games
            _timeLabel.Text = $"{minutes}' {seconds:00}\" {centiseconds:00}";
        }

        // Blinking Rings label when rings are zero
        if (_player != null && _player.Rings == 0)
        {
            _blinkTimer += (float)delta;
            if (_blinkTimer >= 0.25f)
            {
                _blinkTimer = 0.0f;
                _ringsBlinkRed = !_ringsBlinkRed;
                // Alternate between bright red and a warning yellow
                _ringsLabel.AddThemeColorOverride("font_color", _ringsBlinkRed ? new Color(1.0f, 0.15f, 0.15f) : new Color(1.0f, 0.85f, 0.0f));
            }
        }
        else
        {
            _ringsLabel.AddThemeColorOverride("font_color", new Color(1.0f, 0.85f, 0.0f)); // Golden color when has rings
        }
    }

    private void OnPlayerStatsChanged(int rings, int score, float speed, int lives)
    {
        // Sonic score uses 9 digits (e.g. 000000300)
        _scoreLabel.Text = $"{score:000000000}";
        _ringsLabel.Text = $"{rings:000}";
        _livesLabel.Text = $"x {lives:00}";
        
        // Speed in km/h
        float speedKmh = speed * 3.6f;
        _speedLabel.Text = $"{speedKmh:F1} km/h";

        // Bounce effect on ring collect
        if (rings > 0)
        {
            Tween tween = CreateTween().SetTrans(Tween.TransitionType.Back).SetEase(Tween.EaseType.Out);
            // Animate scale to draw attention
            tween.TweenProperty(_ringsLabel, "scale", new Vector2(1.25f, 1.25f), 0.05);
            tween.TweenProperty(_ringsLabel, "scale", Vector2.One, 0.15);
        }
    }
}

