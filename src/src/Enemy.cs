using Godot;
using System;

public partial class Enemy : CharacterBody3D
{
    [Export] public float Speed = 3.0f;
    [Export] public float Gravity = 35.0f;
    [Export] public Vector3 Direction = Vector3.Right;

    protected RayCast3D? _wallRayCast;
    protected RayCast3D? _floorRayCast;
    protected Node3D? _visualsNode;
    protected CpuParticles3D? _explosionParticles;
    protected CollisionShape3D? _collisionShape;
    protected bool _isDestroyed = false;

    public override void _Ready()
    {
        _wallRayCast = GetNodeOrNull<RayCast3D>("WallRayCast");
        _floorRayCast = GetNodeOrNull<RayCast3D>("FloorRayCast");
        _visualsNode = GetNodeOrNull<Node3D>("Visuals");
        _explosionParticles = GetNodeOrNull<CpuParticles3D>("ExplosionParticles");
        _collisionShape = GetNodeOrNull<CollisionShape3D>("CollisionShape3D");

        // Set direction normalized
        Direction = Direction.Normalized();

        // Setup player detection area
        var detectionArea = GetNodeOrNull<Area3D>("DetectionArea");
        if (detectionArea != null)
        {
            detectionArea.BodyEntered += OnPlayerEntered;
        }
    }

    public override void _PhysicsProcess(double delta)
    {
        if (_isDestroyed) return;

        float fDelta = (float)delta;
        Vector3 vel = Velocity;

        // Apply gravity if not on floor
        if (!IsOnFloor())
        {
            vel.Y -= Gravity * fDelta;
        }
        else
        {
            vel.Y = 0.0f;
        }

        // Lock movement to XY plane
        Vector3 pos = GlobalPosition;
        if (Mathf.Abs(pos.Z) > 0.01f)
        {
            pos.Z = 0;
            GlobalPosition = pos;
        }

        // Check for wall collisions or cliff edges
        bool mustTurn = false;

        // Wall collision
        if (IsOnWall())
        {
            mustTurn = true;
        }
        // Wall raycast detection
        if (_wallRayCast != null)
        {
            _wallRayCast.TargetPosition = Direction * 0.8f;
            _wallRayCast.ForceRaycastUpdate();
            if (_wallRayCast.IsColliding())
            {
                mustTurn = true;
            }
        }
        // Cliff edge detection
        if (_floorRayCast != null)
        {
            // Position the raycast slightly in front of the enemy
            _floorRayCast.Position = Direction * 0.6f + Vector3.Up * 0.1f;
            _floorRayCast.ForceRaycastUpdate();
            if (!_floorRayCast.IsColliding())
            {
                mustTurn = true;
            }
        }

        if (mustTurn)
        {
            Direction = -Direction;
            if (_visualsNode != null)
            {
                // Flip visual mesh (rotate 180 degrees around Y axis)
                float targetRot = Direction.X > 0 ? 0.0f : Mathf.Pi;
                _visualsNode.Rotation = new Vector3(0, targetRot, 0);
            }
        }

        // Move the enemy
        vel.X = Direction.X * Speed;
        vel.Z = 0.0f;
        Velocity = vel;
        MoveAndSlide();
    }

    public float GetCollisionHeight()
    {
        if (_collisionShape != null && _collisionShape.Shape != null)
        {
            var shape = _collisionShape.Shape;
            if (shape is CylinderShape3D cylinder)
            {
                return cylinder.Height;
            }
            else if (shape is BoxShape3D box)
            {
                return box.Size.Y;
            }
            else if (shape is SphereShape3D sphere)
            {
                return sphere.Radius * 2.0f;
            }
        }
        return 1.0f;
    }

    protected void OnPlayerEntered(Node3D body)
    {
        if (_isDestroyed) return;

        if (body is Player player)
        {
            // Determine enemy midpoint Y in global coordinates
            float enemyMidY = GlobalPosition.Y + (_collisionShape != null ? _collisionShape.Position.Y : 0.0f);
            // Player's bottom Y (sphere shape radius is 0.55 at offset 0.05, so bottom is Y - 0.5)
            float playerBottomY = player.GlobalPosition.Y - 0.5f;

            // Player is landing on top if they are above the midpoint and not moving upwards
            bool isLandingOnTop = player.Velocity.Y <= 0.1f && (playerBottomY > enemyMidY);

            // If the player is rolling (spin dash/jump/roll state), was rolling, or landing on top of the enemy
            bool isPlayerAttacking = player.IsRolling || player.WasRolling || isLandingOnTop;
            
            if (isPlayerAttacking)
            {
                DestroyEnemy(player);
            }
            else
            {
                player.Hurt(GlobalPosition);
            }
        }
    }

    protected void DestroyEnemy(Player player)
    {
        _isDestroyed = true;
        
        // Give player a little jump bounce
        Vector3 playerVel = player.Velocity;
        playerVel.Y = Mathf.Max(playerVel.Y, 10.0f); // bounce up
        player.Velocity = playerVel;

        player.Score += 200; // Defeat enemy score bonus
        player.PlaySound(880.0f, 0.1f, 0.4f); // Play high pitch explosion beep

        // Disable collision shapes
        if (_collisionShape != null)
        {
            _collisionShape.SetDeferred(CollisionShape3D.PropertyName.Disabled, true);
        }

        var area = GetNodeOrNull<Area3D>("DetectionArea");
        if (area != null)
        {
            area.SetDeferred(Area3D.PropertyName.Monitoring, false);
            area.SetDeferred(Area3D.PropertyName.Monitorable, false);
        }

        // Hide visual mesh
        if (_visualsNode != null)
        {
            _visualsNode.Visible = false;
        }

        // Play explosion particles
        if (_explosionParticles != null)
        {
            _explosionParticles.Restart();
            _explosionParticles.Emitting = true;
            // Delete enemy after particles finish
            GetTree().CreateTimer(_explosionParticles.Lifetime).Timeout += QueueFree;
        }
        else
        {
            QueueFree();
        }
    }
}
