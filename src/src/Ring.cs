using Godot;
using System;

public partial class Ring : Area3D
{
    [Export] public float RotateSpeed = 3.0f;
    [Export] public float GravityForce = 25.0f;
    [Export] public float BounceDampening = 0.7f;

    private bool _isScattered = false;
    private Vector3 _velocity = Vector3.Zero;
    private float _collectibleTimer = 0.0f;
    private float _lifetimeTimer = 10.0f; // Scattered rings disappear after 10s
    private CpuParticles3D? _sparkParticles;
    private MeshInstance3D? _meshInstance;
    private RayCast3D? _rayCast;

    public override void _Ready()
    {
        _sparkParticles = GetNodeOrNull<CpuParticles3D>("SparkParticles");
        _meshInstance = GetNodeOrNull<MeshInstance3D>("MeshInstance3D");
        _rayCast = GetNodeOrNull<RayCast3D>("RayCast3D");

        BodyEntered += OnBodyEntered;
    }

    public override void _PhysicsProcess(double delta)
    {
        float fDelta = (float)delta;

        // Rotate the ring visual
        if (_meshInstance != null)
        {
            _meshInstance.RotateY(RotateSpeed * fDelta);
        }

        // Process physics if scattered
        if (_isScattered)
        {
            _collectibleTimer -= fDelta;
            _lifetimeTimer -= fDelta;

            if (_lifetimeTimer <= 0.0f)
            {
                QueueFree();
                return;
            }

            // Apply gravity and movement
            _velocity.Y -= GravityForce * fDelta;
            GlobalPosition += _velocity * fDelta;

            // Zero Z position just in case
            Vector3 pos = GlobalPosition;
            pos.Z = 0;
            GlobalPosition = pos;

            // Bouncing on obstacles
            if (_rayCast != null)
            {
                // Align raycast with movement direction
                _rayCast.TargetPosition = _velocity * fDelta * 1.5f;
                _rayCast.ForceRaycastUpdate();

                if (_rayCast.IsColliding())
                {
                    Vector3 normal = _rayCast.GetCollisionNormal();
                    // Bounce velocity
                    _velocity = _velocity.Bounce(normal) * BounceDampening;
                    
                    // Reposition slightly away from collision point
                    GlobalPosition = _rayCast.GetCollisionPoint() + normal * 0.1f;
                }
            }
        }
    }

    public void Scatter(Vector3 velocity)
    {
        _isScattered = true;
        _velocity = velocity;
        _collectibleTimer = 0.5f; // Prevent immediate collection
        _lifetimeTimer = 8.0f;

        // Enable raycast for collision detection
        if (_rayCast != null)
        {
            _rayCast.Enabled = true;
        }

        // Make it flash near expiration
        var tween = CreateTween().SetLoops();
        tween.TweenInterval(0.1);
        // We will make the mesh flash near the end of lifetime
        GetTree().CreateTimer(5.0f).Timeout += () => 
        {
            var flashTween = CreateTween().SetLoops();
            flashTween.TweenCallback(Callable.From(() => { if (_meshInstance != null) _meshInstance.Visible = !_meshInstance.Visible; }));
            flashTween.TweenInterval(0.15f);
        };
    }

    private void OnBodyEntered(Node3D body)
    {
        if (body is Player player)
        {
            // If scattered, make sure it is collectible
            if (_isScattered && _collectibleTimer > 0.0f)
            {
                return;
            }

            // Collect ring!
            player.CollectRing();

            // Disable collision to prevent double pickup
            SetDeferred(PropertyName.Monitoring, false);

            // Hide mesh
            if (_meshInstance != null)
            {
                _meshInstance.Visible = false;
            }

            // Trigger pickup particles if any
            if (_sparkParticles != null)
            {
                _sparkParticles.Emitting = true;
                // Wait for particles to finish before deleting
                GetTree().CreateTimer(_sparkParticles.Lifetime).Timeout += QueueFree;
            }
            else
            {
                QueueFree();
            }
        }
    }
}
