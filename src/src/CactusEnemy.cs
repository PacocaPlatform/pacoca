using Godot;
using System;

public partial class CactusEnemy : Enemy
{
    private enum State
    {
        Walking,
        Turning
    }

    private State _currentState = State.Walking;
    
    private Node3D? _walkingModel;
    private Node3D? _turningModel;
    private AnimationPlayer? _walkingAnimPlayer;
    private AnimationPlayer? _turningAnimPlayer;

    public override void _Ready()
    {
        base._Ready();

        _walkingModel = GetNodeOrNull<Node3D>("Visuals/WalkingModel");
        _turningModel = GetNodeOrNull<Node3D>("Visuals/TurningModel");

        if (_walkingModel != null)
        {
            _walkingAnimPlayer = _walkingModel.GetNodeOrNull<AnimationPlayer>("AnimationPlayer");
        }
        if (_turningModel != null)
        {
            _turningAnimPlayer = _turningModel.GetNodeOrNull<AnimationPlayer>("AnimationPlayer");
        }

        // Configure walking animation to loop
        if (_walkingAnimPlayer != null && _walkingAnimPlayer.HasAnimation("mixamo_com"))
        {
            var walkAnim = _walkingAnimPlayer.GetAnimation("mixamo_com");
            walkAnim.LoopMode = Animation.LoopModeEnum.Linear;
            _walkingAnimPlayer.Play("mixamo_com");
        }

        // Hook up turning animation finished signal
        if (_turningAnimPlayer != null)
        {
            _turningAnimPlayer.AnimationFinished += OnTurnAnimationFinished;
        }

        // Initial visual states
        if (_walkingModel != null) _walkingModel.Visible = true;
        if (_turningModel != null) _turningModel.Visible = false;

        _currentState = State.Walking;

        // Apply initial visual rotation based on starting Direction
        UpdateVisualsRotation();
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

        if (_currentState == State.Walking)
        {
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
                _wallRayCast.TargetPosition = Direction * 1.44f;
                _wallRayCast.ForceRaycastUpdate();
                if (_wallRayCast.IsColliding())
                {
                    mustTurn = true;
                }
            }
            // Cliff edge detection
            if (_floorRayCast != null)
            {
                _floorRayCast.Position = Direction * 1.08f + Vector3.Up * 0.1f;
                _floorRayCast.ForceRaycastUpdate();
                if (!_floorRayCast.IsColliding())
                {
                    mustTurn = true;
                }
            }

            if (mustTurn)
            {
                StartTurning();
                // We stop moving during transition
                vel.X = 0.0f;
            }
            else
            {
                vel.X = Direction.X * Speed;
            }
        }
        else if (_currentState == State.Turning)
        {
            // Stand still while turning (gravity is still applied above)
            vel.X = 0.0f;
        }

        vel.Z = 0.0f;
        Velocity = vel;
        MoveAndSlide();
    }

    private void StartTurning()
    {
        _currentState = State.Turning;

        // Hide walking model, show turning model
        if (_walkingModel != null) _walkingModel.Visible = false;
        if (_turningModel != null)
        {
            _turningModel.Visible = true;
            if (_turningAnimPlayer != null && _turningAnimPlayer.HasAnimation("mixamo_com"))
            {
                _turningAnimPlayer.Play("mixamo_com");
            }
        }
    }

    private void OnTurnAnimationFinished(StringName animName)
    {
        if (_currentState == State.Turning)
        {
            // Change direction
            Direction = -Direction;

            // Update visual node rotation based on new direction
            UpdateVisualsRotation();

            // Swap models back
            if (_turningModel != null) _turningModel.Visible = false;
            if (_walkingModel != null)
            {
                _walkingModel.Visible = true;
                if (_walkingAnimPlayer != null && _walkingAnimPlayer.HasAnimation("mixamo_com"))
                {
                    _walkingAnimPlayer.Play("mixamo_com");
                }
            }

            _currentState = State.Walking;
        }
    }

    private void UpdateVisualsRotation()
    {
        if (_visualsNode != null)
        {
            float targetRot = Direction.X > 0 ? Mathf.Pi / 2 : -Mathf.Pi / 2;
            _visualsNode.Rotation = new Vector3(0, targetRot, 0);
        }
    }
}
