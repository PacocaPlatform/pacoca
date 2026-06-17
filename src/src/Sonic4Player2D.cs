using Godot;
using System;

public partial class Sonic4Player2D : CharacterBody2D
{
    public enum PlayerState
    {
        Normal,
        HomingAttack,
        AirDash
    }

    // --- Ground Movement Settings ---
    [ExportGroup("Ground Movement")]
    [Export] public float MaxSpeed { get; set; } = 500.0f;
    [Export] public float Acceleration { get; set; } = 2000.0f;
    [Export] public float Deceleration { get; set; } = 3000.0f; // High deceleration for Sonic 4 stiffness
    [Export] public float Friction { get; set; } = 2500.0f;     // Heavy slide inertia (high friction)

    // --- Jump & Air Settings ---
    [ExportGroup("Jump & Air")]
    [Export] public float JumpVelocity { get; set; } = -700.0f;
    [Export] public float Gravity { get; set; } = 1800.0f;
    [Export] public float FallGravityMultiplier { get; set; } = 1.6f; // Makes falling feel heavy/verticalized
    [Export] public float AirControl { get; set; } = 0.5f;            // Limited responsiveness in air
    [Export] public float AirDeceleration { get; set; } = 1200.0f;    // Friction in the air (still relatively high)

    // --- Homing Attack Settings ---
    [ExportGroup("Homing Attack")]
    [Export] public float HomingSpeed { get; set; } = 900.0f;
    [Export] public float HomingDurationLimit { get; set; } = 0.4f;
    [Export] public float BounceVelocityAfterHit { get; set; } = -400.0f;
    [Export] public string HomingTargetGroupName { get; set; } = "HomingTargets";
    [Export] public NodePath HomingAreaPath { get; set; } = "HomingArea";

    // --- Air Dash Settings ---
    [ExportGroup("Air Dash")]
    [Export] public float AirDashSpeed { get; set; } = 750.0f;
    [Export] public float AirDashDurationLimit { get; set; } = 0.2f;

    // --- Node References ---
    public Area2D? HomingArea { get; private set; }

    // --- State Variables ---
    public PlayerState CurrentState { get; private set; } = PlayerState.Normal;
    
    private float _facingDirection = 1.0f; // 1 = Right, -1 = Left
    private bool _hasUsedAirAction = false;
    private float _stateTimer = 0.0f;
    private Node2D? _homingTarget = null;

    public override void _Ready()
    {
        if (HasNode(HomingAreaPath))
        {
            HomingArea = GetNode<Area2D>(HomingAreaPath);
        }
        else
        {
            GD.PrintErr($"[Sonic4Player2D] HomingArea not found at path: {HomingAreaPath}. Please assign it in the inspector.");
        }
    }

    public override void _PhysicsProcess(double delta)
    {
        float fDelta = (float)delta;

        // Face direction update based on velocity on floor
        if (IsOnFloor() && Mathf.Abs(Velocity.X) > 10.0f)
        {
            _facingDirection = Mathf.Sign(Velocity.X);
        }

        switch (CurrentState)
        {
            case PlayerState.Normal:
                ProcessNormalState(fDelta);
                break;
            case PlayerState.HomingAttack:
                ProcessHomingState(fDelta);
                break;
            case PlayerState.AirDash:
                ProcessAirDashState(fDelta);
                break;
        }
    }

    private void ProcessNormalState(float delta)
    {
        // Reset air actions on ground
        if (IsOnFloor())
        {
            _hasUsedAirAction = false;
        }

        ApplyGravity(delta);
        HandleHorizontalMovement(delta);
        HandleJump();
        
        MoveAndSlide();
    }

    private void ProcessHomingState(float delta)
    {
        _stateTimer += delta;

        // Cancel if target is invalid/freed, timer expires, or we touch the ground
        if (_homingTarget == null || !IsInstanceValid(_homingTarget) || _stateTimer >= HomingDurationLimit || IsOnFloor())
        {
            TransitionToState(PlayerState.Normal);
            return;
        }

        // Move directly to target position
        Vector2 targetPos = _homingTarget.GlobalPosition;
        Vector2 toTarget = targetPos - GlobalPosition;
        
        if (toTarget.Length() > 10.0f)
        {
            Velocity = toTarget.Normalized() * HomingSpeed;
        }
        else
        {
            // If close enough to target, simulate hit rebound
            ResetHomingAfterHit();
            return;
        }

        MoveAndSlide();
    }

    private void ProcessAirDashState(float delta)
    {
        _stateTimer += delta;

        // Cancel if timer expires or we touch ground
        if (_stateTimer >= AirDashDurationLimit || IsOnFloor())
        {
            TransitionToState(PlayerState.Normal);
            return;
        }

        // Maintain constant horizontal dash speed, no vertical speed
        Velocity = new Vector2(_facingDirection * AirDashSpeed, 0.0f);
        MoveAndSlide();
    }

    private void ApplyGravity(float delta)
    {
        if (!IsOnFloor())
        {
            float currentGravity = Gravity;
            
            // Heavy verticalized fall: increase gravity if falling
            if (Velocity.Y > 0.0f)
            {
                currentGravity *= FallGravityMultiplier;
            }

            Vector2 vel = Velocity;
            vel.Y += currentGravity * delta;
            Velocity = vel;
        }
    }

    private void HandleHorizontalMovement(float delta)
    {
        float inputX = Input.GetAxis("move_left", "move_right");
        Vector2 vel = Velocity;

        // Sonic 4 Style facing direction update (can change direction in air too)
        if (Mathf.Abs(inputX) > 0.05f)
        {
            _facingDirection = Mathf.Sign(inputX);
        }

        if (Mathf.Abs(inputX) > 0.05f)
        {
            // Accelerated movement
            float acc = IsOnFloor() ? Acceleration : (Acceleration * AirControl);
            vel.X = Mathf.MoveToward(vel.X, inputX * MaxSpeed, acc * delta);
        }
        else
        {
            // Rapid deceleration / friction for a "stiff" slide (Sonic 4 feel)
            float decel = IsOnFloor() ? Friction : AirDeceleration;
            vel.X = Mathf.MoveToward(vel.X, 0.0f, decel * delta);
        }

        Velocity = vel;
    }

    private void HandleJump()
    {
        bool isJumpPressed = Input.IsActionJustPressed("jump");

        if (IsOnFloor())
        {
            if (isJumpPressed)
            {
                Vector2 vel = Velocity;
                vel.Y = JumpVelocity;
                Velocity = vel;
            }
        }
        else
        {
            // In the air: check for Homing Attack / Air Dash
            if (isJumpPressed && !_hasAirDashedOrHomed())
            {
                ExecuteAirAction();
            }
        }
    }

    private bool _hasAirDashedOrHomed()
    {
        return _hasUsedAirAction;
    }

    private void ExecuteAirAction()
    {
        _hasUsedAirAction = true;
        _homingTarget = GetBestHomingTarget();

        if (_homingTarget != null)
        {
            TransitionToState(PlayerState.HomingAttack);
        }
        else
        {
            TransitionToState(PlayerState.AirDash);
        }
    }

    private Node2D? GetBestHomingTarget()
    {
        if (HomingArea == null) return null;

        var overlappingBodies = HomingArea.GetOverlappingBodies();
        Node2D? bestTarget = null;
        float closestDistance = float.MaxValue;

        foreach (var body in overlappingBodies)
        {
            if (body is Node2D target && target.IsInGroup(HomingTargetGroupName))
            {
                // Ensure target is generally in front of player
                Vector2 toTarget = target.GlobalPosition - GlobalPosition;
                float dot = toTarget.Normalized().Dot(new Vector2(_facingDirection, 0));

                if (dot > -0.2f) // Allow target if in front or slightly to the sides
                {
                    float dist = GlobalPosition.DistanceTo(target.GlobalPosition);
                    if (dist < closestDistance)
                    {
                        closestDistance = dist;
                        bestTarget = target;
                    }
                }
            }
        }

        return bestTarget;
    }

    private void TransitionToState(PlayerState newState)
    {
        CurrentState = newState;
        _stateTimer = 0.0f;

        if (newState == PlayerState.Normal)
        {
            _homingTarget = null;
        }
    }

    public void ResetHomingAfterHit()
    {
        TransitionToState(PlayerState.Normal);
        _hasUsedAirAction = false;
        
        // Classic jump bounce when hitting target (using configured bounce velocity)
        Velocity = new Vector2(Velocity.X, BounceVelocityAfterHit);
    }
}
