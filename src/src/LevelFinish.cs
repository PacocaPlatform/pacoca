using Godot;
using System;

public partial class LevelFinish : Area3D
{
    [Export] public float NormalRotateSpeed = 3.0f;
    [Export] public float FastRotateSpeed = 40.0f;

    private Node3D _coinVisual = null!;
    private CpuParticles3D _sparkParticles = null!;
    private AudioStreamPlayer _audioPlayer = null!;
    private AudioStreamGeneratorPlayback? _audioPlayback;

    private bool _triggered = false;
    private Player? _capturedPlayer;
    private float _currentRotateSpeed;
    private float _timer = 0.0f;

    public override void _Ready()
    {
        _coinVisual = GetNode<Node3D>("CoinVisual");
        // Set a much larger base size for the giant coin
        _coinVisual.Scale = new Vector3(2.5f, 2.5f, 2.5f);

        _sparkParticles = GetNode<CpuParticles3D>("SparkParticles");
        // Scale particles container so the effect scales with the coin
        _sparkParticles.Scale = new Vector3(2.0f, 2.0f, 2.0f);

        _currentRotateSpeed = NormalRotateSpeed;

        // Setup procedural audio player
        _audioPlayer = new AudioStreamPlayer();
        AddChild(_audioPlayer);
        var generator = new AudioStreamGenerator();
        generator.MixRate = 44100.0f;
        generator.BufferLength = 0.1f;
        _audioPlayer.Stream = generator;
        _audioPlayer.Play();
        _audioPlayback = _audioPlayer.GetStreamPlayback() as AudioStreamGeneratorPlayback;

        BodyEntered += OnBodyEntered;
    }

    public override void _PhysicsProcess(double delta)
    {
        float fDelta = (float)delta;

        // Rotate the coin visual around Y
        _coinVisual.RotateY(_currentRotateSpeed * fDelta);

        if (_triggered && _capturedPlayer != null)
        {
            // Smoothly Lerp player to the center of the coin on the XY plane
            Vector3 targetPos = GlobalPosition;
            // Maintain player's Z at strictly 0
            targetPos.Z = 0;
            _capturedPlayer.GlobalPosition = _capturedPlayer.GlobalPosition.Lerp(targetPos, 8.0f * fDelta);

            _timer += fDelta;
            if (_timer >= 2.0f)
            {
                // Stop physics process and show the level finish statistics screen
                var main = GetTree().CurrentScene as Main;
                if (main != null)
                {
                    main.CompleteLevel(_capturedPlayer.Rings, _capturedPlayer.Score, _capturedPlayer.TimeElapsed);
                }
                SetPhysicsProcess(false);
            }
        }
    }

    private void OnBodyEntered(Node3D body)
    {
        if (body is Player player && !_triggered)
        {
            _triggered = true;
            _capturedPlayer = player;
            player.IsLevelFinished = true;
            
            // Vanish the player so only the coin remains visible and spinning
            player.Visible = false;

            _currentRotateSpeed = FastRotateSpeed;

            // Dynamically scale the coin up even more when triggered
            var tween = CreateTween();
            tween.TweenProperty(_coinVisual, "scale", new Vector3(3.8f, 3.8f, 3.8f), 0.8f)
                 .SetTrans(Tween.TransitionType.Back)
                 .SetEase(Tween.EaseType.Out);

            // Trigger particles emission
            _sparkParticles.Emitting = true;

            // Play procedural victory audio
            PlayVictoryJingle();
        }
    }

    private async void PlayVictoryJingle()
    {
        // Happy retro arpeggio: E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz), E6 (1318.51Hz), G6 (1567.98Hz), C7 (2093.00Hz)
        float[] notes = { 659.25f, 783.99f, 1046.50f, 1318.51f, 1567.98f, 2093.00f };
        float duration = 0.15f;

        for (int i = 0; i < notes.Length; i++)
        {
            PlaySound(notes[i], duration, 0.35f);
            await ToSignal(GetTree().CreateTimer(duration * 0.8f), SceneTreeTimer.SignalName.Timeout);
        }

        // Final happy chord note
        PlaySound(2093.00f, 0.6f, 0.45f);
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
                float envelope = (float)(numSamples - i) / numSamples;
                float sample = Mathf.Sin(phase) * volume * envelope;
                _audioPlayback.PushFrame(new Vector2(sample, sample));
                phase += phaseIncrement;
            }
        }
    }
}
