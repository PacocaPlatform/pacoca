using Godot;
using System;

public partial class Player : CharacterBody3D
{
    // Movement configuration (Sonic style)
    [Export] public float MaxSpeed = 24.0f;
    // Absolute horizontal speed cap (70 km/h = 19.44 m/s). Caps spin dash, slopes and boosts.
    [Export] public float MaxSpeedCap = 19.44f;
    [Export] public float Acceleration = 18.0f;
    [Export] public float Deceleration = 45.0f;
    [Export] public float Friction = 30.0f;
    [Export] public float Gravity = 35.0f;
    [Export] public float JumpVelocity = 21.0f;
    [Export] public float AirControl = 0.7f;
    [Export] public float SlopeAccelerationMultiplier = 15.0f;

    // Air dash (second jump) parameters
    [Export] public float AirDashSpeed = 18.0f;            // upward launch of the second jump
    [Export] public float AirDashHorizontalSpeed = 6.0f;   // sideways nudge when a direction is held
    
    // Spin Dash parameters
    [Export] public float SpinDashMinCharge = 18.0f;
    [Export] public float SpinDashMaxCharge = 38.0f;
    
    // State variables
    [Export] public int Lives = 3;
    [Export] public Vector3 SpawnPosition = new Vector3(-12.0f, 1.5f, 0.0f);
    public bool IsRolling = false;
    public bool WasRolling = false;
    public bool IsSpinDashing = false;
    public float SpinDashCharge = 0.0f;
    public int Rings = 0;
    public int Score = 0;
    public double TimeElapsed = 0.0;
    public bool IsLevelFinished = false;
    
    private bool _isInvincible = false;
    private float _invincibilityTimer = 0.0f;
    private float _boostTimer = 0.0f;
    private Vector3 _customBoostVelocity = Vector3.Zero;
    private Vector3 _groundNormal = Vector3.Up;
    private float _animationTime = 0.0f;
    private int _facingDirection = 1; // 1 = right, -1 = left
    private float _currentZRotation = 0.0f;
    private float _currentYRotation = Mathf.Pi / 2; // Default to facing right
    private bool _hasAirDashed = false;
    private float _airDashGravityDelay = 0.0f;
    private bool _wasOnFloor = true;
    private CameraController? _camera;

    // Live telemetry to the map editor (enabled only when launched with --telemetry=<url>,
    // which the editor's "Test Level" button passes). Throttled so HTTP never stalls physics.
    private bool _telemetryEnabled = false;
    private string _telemetryUrl = "";
    private string _telemetryLevel = "";
    private float _telemetryTimer = 0.0f;
    private const float TelemetryInterval = 0.06f; // ~15 Hz
    private static readonly System.Net.Http.HttpClient _telemetryHttp =
        new System.Net.Http.HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };

    // Node references
    private Node3D _visualsNode = null!;
    private Node3D _bodyNode = null!;
    private Node3D _idleModel = null!;
    private Node3D _runningModel = null!;
    private Node3D _jumpingModel = null!;
    private AnimationPlayer _idleAnimPlayer = null!;
    private AnimationPlayer _runningAnimPlayer = null!;
    private AnimationPlayer _jumpingAnimPlayer = null!;
    private CpuParticles3D _dustParticles = null!;
    private CpuParticles3D _speedWindParticles = null!;
    
    // Audio Player for procedural sounds
    private AudioStreamPlayer _audioPlayer = null!;
    private AudioStreamGeneratorPlayback? _audioPlayback;

    // Signal for UI
    [Signal] public delegate void PlayerStatsChangedEventHandler(int rings, int score, float speed, int lives);

    public override void _Ready()
    {
        // Get references to nodes
        _visualsNode = GetNode<Node3D>("Visuals");
        _bodyNode = GetNode<Node3D>("Visuals/Body");
        _idleModel = GetNode<Node3D>("Visuals/Body/IdleModel");
        _runningModel = GetNode<Node3D>("Visuals/Body/RunningModel");
        _jumpingModel = GetNode<Node3D>("Visuals/Body/JumpingModel");
        _idleAnimPlayer = GetNode<AnimationPlayer>("Visuals/Body/IdleModel/AnimationPlayer");
        _runningAnimPlayer = GetNode<AnimationPlayer>("Visuals/Body/RunningModel/AnimationPlayer");
        _jumpingAnimPlayer = GetNode<AnimationPlayer>("Visuals/Body/JumpingModel/AnimationPlayer");

        // Set up animations to loop and play
        if (_idleAnimPlayer.HasAnimation("mixamo_com"))
        {
            _idleAnimPlayer.GetAnimation("mixamo_com").LoopMode = Animation.LoopModeEnum.Linear;
            _idleAnimPlayer.Play("mixamo_com");
        }
        if (_runningAnimPlayer.HasAnimation("mixamo_com"))
        {
            _runningAnimPlayer.GetAnimation("mixamo_com").LoopMode = Animation.LoopModeEnum.Linear;
            _runningAnimPlayer.Play("mixamo_com");
        }
        if (_jumpingAnimPlayer.HasAnimation("mixamo_com"))
        {
            var anim = _jumpingAnimPlayer.GetAnimation("mixamo_com");
            // Remove root/hips translation tracks to prevent visual offset (in-place jump animation)
            for (int i = anim.GetTrackCount() - 1; i >= 0; i--)
            {
                var trackPath = anim.TrackGetPath(i);
                var trackType = anim.TrackGetType(i);
                if (trackType == Animation.TrackType.Position3D && trackPath.ToString().Contains("mixamorig_Hips"))
                {
                    anim.RemoveTrack(i);
                }
            }
            anim.LoopMode = Animation.LoopModeEnum.Linear;
            _jumpingAnimPlayer.Play("mixamo_com");
        }
        
        _dustParticles = GetNode<CpuParticles3D>("DustParticles");
        _speedWindParticles = GetNode<CpuParticles3D>("SpeedWindParticles");
        
        // Setup procedural audio player
        _audioPlayer = new AudioStreamPlayer();
        AddChild(_audioPlayer);
        var generator = new AudioStreamGenerator();
        generator.MixRate = 44100.0f;
        generator.BufferLength = 0.1f;
        _audioPlayer.Stream = generator;
        _audioPlayer.Play();
        _audioPlayback = _audioPlayer.GetStreamPlayback() as AudioStreamGeneratorPlayback;
        
        ConfigureTelemetry();

        EmitStats();
    }

    // Reads --telemetry=<baseurl> / --level=<id> from the cmdline user args (passed by the
    // map editor). When present, the player streams its position to the editor for the live map.
    private void ConfigureTelemetry()
    {
        foreach (string arg in OS.GetCmdlineUserArgs())
        {
            if (arg.StartsWith("--telemetry="))
            {
                _telemetryUrl = arg.Substring("--telemetry=".Length).Trim().TrimEnd('/') + "/api/telemetry";
                _telemetryEnabled = !string.IsNullOrEmpty(_telemetryUrl);
            }
            else if (arg == "--telemetry")
            {
                _telemetryUrl = "http://127.0.0.1:8000/api/telemetry";
                _telemetryEnabled = true;
            }
            else if (arg.StartsWith("--level="))
            {
                _telemetryLevel = arg.Substring("--level=".Length).Trim();
            }
        }
        if (_telemetryEnabled)
        {
            GD.Print($"Player.cs: live telemetry -> {_telemetryUrl}");
        }
    }

    private void SendTelemetry()
    {
        try
        {
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            Vector3 p = GlobalPosition;
            string json =
                "{" +
                $"\"level\":\"{_telemetryLevel}\"," +
                $"\"x\":{p.X.ToString("0.###", ci)}," +
                $"\"y\":{p.Y.ToString("0.###", ci)}," +
                $"\"on_floor\":{(IsOnFloor() ? "true" : "false")}," +
                $"\"speed\":{Velocity.Length().ToString("0.###", ci)}" +
                "}";
            var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
            // Fire-and-forget; observe the task so a network failure never surfaces as an
            // unobserved exception, and never let telemetry interfere with gameplay.
            _ = _telemetryHttp.PostAsync(_telemetryUrl, content).ContinueWith(
                t => { _ = t.Exception; },
                System.Threading.Tasks.TaskContinuationOptions.OnlyOnFaulted);
        }
        catch
        {
            // Swallow: telemetry must never break the game.
        }
    }

    public override void _PhysicsProcess(double delta)
    {
        float fDelta = (float)delta;

        if (_telemetryEnabled)
        {
            _telemetryTimer -= fDelta;
            if (_telemetryTimer <= 0.0f)
            {
                _telemetryTimer = TelemetryInterval;
                SendTelemetry();
            }
        }

        if (IsLevelFinished)
        {
            Velocity = Vector3.Zero;
            IsRolling = true;
            UpdateVisuals(fDelta);
            return;
        }

        WasRolling = IsRolling;
        TimeElapsed += delta;
        
        // Pit detection (falling below the level)
        if (GlobalPosition.Y < -15.0f)
        {
            Respawn();
            return;
        }

        // Locked to XY plane - ensure Z position is strictly 0
        Vector3 pos = GlobalPosition;
        if (Mathf.Abs(pos.Z) > 0.01f)
        {
            pos.Z = 0;
            GlobalPosition = pos;
        }

        // Manage timers
        if (_boostTimer > 0.0f)
        {
            _boostTimer -= fDelta;
        }
        if (_isInvincible)
        {
            _invincibilityTimer -= fDelta;
            if (_invincibilityTimer <= 0.0f)
            {
                _isInvincible = false;
            }
            // Flash character visually
            _visualsNode.Visible = (Mathf.Wrap((int)(_invincibilityTimer * 20), 0, 2) == 0);
        }
        else
        {
            _visualsNode.Visible = true;
        }

        // Calculate custom gravity/physics
        Vector3 vel = Velocity;
        
        // Ground detection and normal alignment
        if (IsOnFloor())
        {
            _hasAirDashed = false;
            _airDashGravityDelay = 0.0f;
            _groundNormal = GetFloorNormal();
            
            // Apply horizontal slope physics (gravity pulls you down slopes)
            if (Mathf.Abs(_groundNormal.X) > 0.05f && !IsSpinDashing)
            {
                // Friction is reduced on slopes
                float slopeForce = -_groundNormal.X * SlopeAccelerationMultiplier * fDelta;
                vel.X += slopeForce;
            }
        }
        else
        {
            // Smoothly align back to upright in air
            _groundNormal = _groundNormal.Lerp(Vector3.Up, 10.0f * fDelta);
            
            // Air gravity
            if (_airDashGravityDelay > 0.0f)
            {
                _airDashGravityDelay -= fDelta;
            }
            else
            {
                vel.Y -= Gravity * fDelta;
            }
        }

        // Process inputs if not locked by boost/dash
        if (_boostTimer <= 0.0f)
        {
            HandleInputs(fDelta, ref vel);
        }
        else
        {
            // Apply dash/spring lock velocity override
            vel.X = _customBoostVelocity.X;
            if (Mathf.Abs(_customBoostVelocity.Y) > 0.01f)
            {
                vel.Y = _customBoostVelocity.Y;
            }
            // Slowly decay custom boost force
            _customBoostVelocity = _customBoostVelocity.Lerp(Vector3.Zero, 2.0f * fDelta);
        }

        // Clamp horizontal speed to the cap (80 km/h) regardless of source (spin dash, slopes, boost)
        if (Mathf.Abs(vel.X) > MaxSpeedCap)
        {
            vel.X = Mathf.Sign(vel.X) * MaxSpeedCap;
        }

        // Apply velocities
        bool wasAirborneBeforeMove = !IsOnFloor();
        float preMoveVelX = vel.X;
        Velocity = vel;
        MoveAndSlide();

        // Prevent wall/corner collisions from injecting extra horizontal speed while airborne.
        // The spherical collider can roll over a wall's top edge during the air dash, where the
        // diagonal corner normal makes MoveAndSlide convert the (gravity-suspended) upward launch
        // into an uncontrollable horizontal fling. A collision must never speed us up sideways.
        if (wasAirborneBeforeMove && !IsOnFloor())
        {
            Vector3 slidVel = Velocity;
            if (Mathf.Abs(slidVel.X) > Mathf.Abs(preMoveVelX) + 0.01f)
            {
                slidVel.X = Mathf.Sign(slidVel.X) * Mathf.Abs(preMoveVelX);
                Velocity = slidVel;
            }
        }

        // Landing logic: reset rolling state on landing to restore full ground control / braking
        bool onFloor = IsOnFloor();
        if (onFloor && !_wasOnFloor)
        {
            IsRolling = false;
        }
        _wasOnFloor = onFloor;

        // Strict 2D Lock: prevent Z drift
        vel = Velocity;
        vel.Z = 0.0f;
        Velocity = vel;

        // Screen boundary clamp (left edge)
        if (_camera == null)
        {
            _camera = GetParent().GetNodeOrNull<CameraController>("Camera3D");
        }
        if (_camera != null)
        {
            float leftBoundaryX = _camera.GetLeftBoundaryX();
            float playerRadius = 0.55f;
            if (GlobalPosition.X < leftBoundaryX + playerRadius)
            {
                Vector3 clampedPos = GlobalPosition;
                clampedPos.X = leftBoundaryX + playerRadius;
                GlobalPosition = clampedPos;
                
                // Zero horizontal leftward velocity if moving left
                if (Velocity.X < 0)
                {
                    Vector3 pVel = Velocity;
                    pVel.X = 0;
                    Velocity = pVel;
                }
            }
        }

        // Visual orientation & procedural animations
        UpdateVisuals(fDelta);
        
        // Speed particles
        float speed = Mathf.Abs(Velocity.X);
        _speedWindParticles.Emitting = (speed > MaxSpeed * 0.8f);
        
        EmitStats();
    }

    private void HandleInputs(float delta, ref Vector3 vel)
    {
        float moveInput = Input.GetAxis("move_left", "move_right");
        bool isDownPressed = Input.IsActionPressed("move_down");
        bool isJumpPressed = Input.IsActionJustPressed("jump");

        // Set facing direction
        if (moveInput > 0.05f && !IsSpinDashing) _facingDirection = 1;
        else if (moveInput < -0.05f && !IsSpinDashing) _facingDirection = -1;

        if (IsOnFloor())
        {
            // Reset rolling if moving very slowly
            if (IsRolling && Mathf.Abs(vel.X) < 1.0f)
            {
                IsRolling = false;
            }

            // Check for Spin Dash activation
            if (isDownPressed && Mathf.Abs(vel.X) < 1.0f)
            {
                if (!IsSpinDashing)
                {
                    IsSpinDashing = true;
                    SpinDashCharge = 0.0f;
                    PlaySound(440f, 0.1f, 0.4f); // Procedural spin dash start
                }
                
                vel.X = Mathf.MoveToward(vel.X, 0, Friction * 2.0f * delta);
                
                if (isJumpPressed)
                {
                    SpinDashCharge = Mathf.Min(SpinDashCharge + 6.0f, SpinDashMaxCharge);
                    PlaySound(440f + SpinDashCharge * 15f, 0.1f, 0.5f); // Higher pitch as charged
                    // Add jump spin particle burst
                    _dustParticles.Restart();
                }
                
                // Slow decay of charge
                SpinDashCharge = Mathf.MoveToward(SpinDashCharge, SpinDashMinCharge, 4.0f * delta);
            }
            else
            {
                // Release Spin Dash
                if (IsSpinDashing)
                {
                    IsSpinDashing = false;
                    IsRolling = true;
                    vel.X = _facingDirection * (SpinDashMinCharge + SpinDashCharge);
                    PlaySound(600f, 0.25f, 0.6f); // Launch sound
                    _dustParticles.Restart();
                }
                
                // Standard movement
                if (moveInput != 0)
                {
                    if (IsRolling)
                    {
                        // Rolling movement - slower acceleration/deceleration on player inputs
                        vel.X = Mathf.MoveToward(vel.X, moveInput * MaxSpeed, Acceleration * 0.4f * delta);
                    }
                    else
                    {
                        // Standard running movement
                        float targetSpeed = moveInput * MaxSpeed;
                        // Decelerate (brake) faster than accelerating
                        bool isBraking = (moveInput > 0 && vel.X < 0) || (moveInput < 0 && vel.X > 0);
                        float rate = isBraking ? Deceleration : Acceleration;
                        vel.X = Mathf.MoveToward(vel.X, targetSpeed, rate * delta);
                        
                        // Dust emission when turning rapidly (skidding)
                        _dustParticles.Emitting = isBraking && Mathf.Abs(vel.X) > 5.0f;
                    }
                }
                else
                {
                    // Apply Friction
                    float decelRate = IsRolling ? (Friction * 0.25f) : Friction;
                    vel.X = Mathf.MoveToward(vel.X, 0, decelRate * delta);
                    _dustParticles.Emitting = false;
                }

                // Initiate Roll by pressing down while running
                if (isDownPressed && Mathf.Abs(vel.X) > 4.0f && !IsRolling)
                {
                    IsRolling = true;
                    PlaySound(350f, 0.1f, 0.3f);
                }

                // Jump
                if (isJumpPressed && !isDownPressed)
                {
                    vel.Y = JumpVelocity;
                    IsRolling = true;
                    PlaySound(523.25f, 0.15f, 0.5f); // C5 note jump sound
                    _dustParticles.Restart();
                }
            }
        }
        else
        {
            // Air movement control
            _dustParticles.Emitting = false;
            
            if (isJumpPressed && !_hasAirDashed)
            {
                _hasAirDashed = true;
                
                float moveInputX = Input.GetAxis("move_left", "move_right");

                // The second jump is primarily a vertical launch. Holding a direction adds only a
                // modest sideways nudge (AirDashHorizontalSpeed) instead of a full 45 degree dash,
                // so dashing toward a side no longer flings the player with uncontrollable speed.
                float horizontal = 0.0f;
                if (moveInputX > 0.1f) horizontal = AirDashHorizontalSpeed;
                else if (moveInputX < -0.1f) horizontal = -AirDashHorizontalSpeed;

                vel = new Vector3(horizontal, AirDashSpeed, 0.0f);
                
                // State updates
                IsRolling = true;
                _airDashGravityDelay = 0.15f; // suspend gravity briefly for sharp upward feel
                
                // Play double tone sound (procedural beep)
                PlaySound(660f, 0.07f, 0.5f);
                PlaySound(880f, 0.07f, 0.5f);
                
                // Dust particles burst
                _dustParticles.Restart();
            }
            else
            {
                if (moveInput != 0)
                {
                    vel.X = Mathf.MoveToward(vel.X, moveInput * MaxSpeed, Acceleration * AirControl * delta);
                }
                
                // Adjust height if jump released early (variable jump height)
                if (!_hasAirDashed && vel.Y > 0 && !Input.IsActionPressed("jump"))
                {
                    vel.Y = Mathf.MoveToward(vel.Y, 0, Gravity * 1.5f * delta);
                }
            }
        }
    }

    private void UpdateVisuals(float delta)
    {
        // Calculate ground angle based on the normal vector on the XY plane
        float targetAngle = Mathf.Atan2(_groundNormal.X, _groundNormal.Y);
        
        // Smoothly interpolate Z-rotation (slope) and Y-rotation (facing direction)
        float targetYRotation = _facingDirection == 1 ? Mathf.Pi / 2 : -Mathf.Pi / 2;
        
        _currentZRotation = Mathf.LerpAngle(_currentZRotation, -targetAngle, 15.0f * delta);
        _currentYRotation = Mathf.LerpAngle(_currentYRotation, targetYRotation, 20.0f * delta);

        // Apply Z-rotation globally (tilt along screen plane) and Y-rotation locally (turning left/right)
        _visualsNode.Basis = Basis.FromEuler(new Vector3(0, 0, _currentZRotation)) * 
                             Basis.FromEuler(new Vector3(0, _currentYRotation, 0));

        // Animate parts depending on status
        if (IsRolling)
        {
            // Reset body position & local rotation
            _bodyNode.Position = _bodyNode.Position.Lerp(Vector3.Zero, 10f * delta);
            _bodyNode.Rotation = _bodyNode.Rotation.Lerp(Vector3.Zero, 10f * delta);
            
            // Show jumping model and hide others
            _idleModel.Visible = false;
            _runningModel.Visible = false;
            _jumpingModel.Visible = true;
            _jumpingAnimPlayer.SpeedScale = 1.0f;
        }
        else if (IsSpinDashing)
        {
            // Shaking body effect
            _animationTime += delta * 50.0f;
            float shake = Mathf.Sin(_animationTime) * 0.1f;
            _bodyNode.Position = new Vector3(0, shake, 0);
            
            // Show jumping model for spin dash charging
            _idleModel.Visible = false;
            _runningModel.Visible = false;
            _jumpingModel.Visible = true;
            _jumpingAnimPlayer.SpeedScale = 3.0f;
            _bodyNode.Rotation = new Vector3(0, 0, -Mathf.Pi/6);
        }
        else
        {
            // Reset body position & local rotation
            _bodyNode.Position = _bodyNode.Position.Lerp(Vector3.Zero, 10f * delta);
            _bodyNode.Rotation = _bodyNode.Rotation.Lerp(Vector3.Zero, 10f * delta);
            _bodyNode.Scale = Vector3.One;
            
            float speed = Mathf.Abs(Velocity.X);
            if (IsOnFloor())
            {
                if (speed > 0.1f)
                {
                    // Show running model
                    _idleModel.Visible = false;
                    _runningModel.Visible = true;
                    _jumpingModel.Visible = false;
                    
                    // Adjust animation speed based on velocity
                    _runningAnimPlayer.SpeedScale = Mathf.Max(0.5f, speed / MaxSpeed * 1.8f);
                }
                else
                {
                    // Show idle model
                    _idleModel.Visible = true;
                    _runningModel.Visible = false;
                    _jumpingModel.Visible = false;
                    _idleAnimPlayer.SpeedScale = 1.0f;
                }
            }
            else
            {
                // In air but not rolling (e.g. falling)
                _idleModel.Visible = false;
                _runningModel.Visible = false;
                _jumpingModel.Visible = true;
                _jumpingAnimPlayer.SpeedScale = 1.0f;
            }
        }
    }

    public void CollectRing()
    {
        Rings++;
        Score += 100;
        PlayRingSound();
        EmitStats();
    }

    public void ApplyBoost(Vector3 velocityBoost, float lockDuration)
    {
        _boostTimer = lockDuration;
        _customBoostVelocity = velocityBoost;
        Velocity = velocityBoost;
        IsRolling = true;
        PlaySound(783.99f, 0.15f, 0.6f); // G5 note boost sound
    }

    public void Hurt(Vector3 hazardSource)
    {
        if (_isInvincible) return;

        if (Rings > 0)
        {
            ScatterRings();
            Rings = 0;
            _isInvincible = true;
            _invincibilityTimer = 2.0f;
            
            // Bounce player away
            Vector3 pushDir = (GlobalPosition - hazardSource).Normalized();
            pushDir.Z = 0.0f;
            Velocity = new Vector3(pushDir.X * 12.0f, 10.0f, 0);
            IsRolling = false;
            
            PlaySound(150.0f, 0.4f, 0.8f); // Low frequency thud/hurt sound
            EmitStats();
        }
        else
        {
            // Game Over / Respawn
            Respawn();
        }
    }

    private void ScatterRings()
    {
        int count = Mathf.Min(Rings, 20); // Limit scattered rings to avoid lag
        var ringScene = GD.Load<PackedScene>("res://scenes/ring.tscn");
        
        for (int i = 0; i < count; i++)
        {
            var ringInstance = ringScene.Instantiate<Ring>();
            GetParent().AddChild(ringInstance);
            
            // Spawn slightly offset from player
            ringInstance.GlobalPosition = GlobalPosition + new Vector3(0, 0.5f, 0);
            
            // Scatter in an arc
            float angle = Mathf.Pi * (i / (float)count) + (float)GD.RandRange(-0.2f, 0.2f);
            float speed = (float)GD.RandRange(6.0f, 12.0f);
            Vector3 velocity = new Vector3(Mathf.Cos(angle) * speed, Mathf.Sin(angle) * speed + 3.0f, 0.0f);
            
            ringInstance.Scatter(velocity);
        }
    }

    public void Respawn()
    {
        Rings = 0;
        Velocity = Vector3.Zero;
        _boostTimer = 0.0f;
        IsRolling = false;
        IsSpinDashing = false;
        _isInvincible = true;
        _invincibilityTimer = 3.0f;
        TimeElapsed = 0.0;
        
        Lives--;
        if (Lives <= 0)
        {
            // Game Over: reset lives and return to Game Over screen
            Lives = 3;
            Score = 0;
            TimeElapsed = 0;
            GetTree().ChangeSceneToFile("res://scenes/game_over.tscn");
        }
        else
        {
            PlaySound(220.0f, 0.5f, 0.5f);
            
            // Restart the stage (reload the level scene)
            var main = GetTree().CurrentScene as Main;
            if (main != null)
            {
                main.RestartStage();
            }
            else
            {
                GlobalPosition = SpawnPosition;
            }
        }
        
        EmitStats();
    }

    private void EmitStats()
    {
        EmitSignal(SignalName.PlayerStatsChanged, Rings, Score, Velocity.Length(), Lives);
    }

    // Procedural Audio Helper for retro sound effects
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
                // Envelope: Linear fade out
                float envelope = (float)(numSamples - i) / numSamples;
                float sample = Mathf.Sin(phase) * volume * envelope;
                _audioPlayback.PushFrame(new Vector2(sample, sample));
                phase += phaseIncrement;
            }
        }
    }

    private void PlayRingSound()
    {
        // Sonic-like chime sound: a sequence of two rapid high tones
        if (_audioPlayback == null) return;

        float sampleRate = 44100.0f;
        float duration = 0.25f;
        int numSamples = (int)(sampleRate * duration);
        float phase = 0.0f;

        for (int i = 0; i < numSamples; i++)
        {
            if (_audioPlayback.GetFramesAvailable() > 0)
            {
                // Sequence pitch: 2000Hz for first half, 2500Hz for second half
                float currentFreq = i < numSamples / 2 ? 1800.0f : 2300.0f;
                float phaseIncrement = (2.0f * Mathf.Pi * currentFreq) / sampleRate;
                float envelope = (float)(numSamples - i) / numSamples;
                float sample = Mathf.Sin(phase) * 0.3f * envelope;
                
                _audioPlayback.PushFrame(new Vector2(sample, sample));
                phase += phaseIncrement;
            }
        }
    }
}
