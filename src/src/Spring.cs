using Godot;
using System;

public partial class Spring : Area3D
{
    [Export] public float LaunchForce = 22.0f;
    [Export] public Vector3 LaunchDirection = Vector3.Up;
    [Export] public float ControlLockDuration = 0.5f;

    private Node3D? _meshNode;
    private bool _isAnimating = false;

    public override void _Ready()
    {
        _meshNode = GetNodeOrNull<Node3D>("Mesh");
        BodyEntered += OnBodyEntered;
        LaunchDirection = LaunchDirection.Normalized();
    }

    private void OnBodyEntered(Node3D body)
    {
        if (body is Player player)
        {
            // Project launch force
            Vector3 boostVel = LaunchDirection * LaunchForce;
            
            // Apply boost to player
            player.ApplyBoost(boostVel, ControlLockDuration);

            // Play procedural spring bounce animation using Tween
            if (_meshNode != null && !_isAnimating)
            {
                _isAnimating = true;
                Vector3 originalScale = _meshNode.Scale;
                Vector3 originalPos = _meshNode.Position;

                Tween tween = CreateTween().SetTrans(Tween.TransitionType.Back).SetEase(Tween.EaseType.Out);
                
                // Compress spring mesh
                Vector3 compressedScale = originalScale;
                compressedScale.Y *= 0.3f; // Squash vertically
                Vector3 compressedPos = originalPos;
                compressedPos += LaunchDirection * -0.2f; // Push down in opposite direction

                tween.TweenProperty(_meshNode, "scale", compressedScale, 0.05);
                tween.Parallel().TweenProperty(_meshNode, "position", compressedPos, 0.05);
                
                // Bounce back and overshoot
                Vector3 bounceScale = originalScale;
                bounceScale.Y *= 1.4f; // Stretch vertically
                Vector3 bouncePos = originalPos;
                bouncePos += LaunchDirection * 0.3f; // Jump out

                tween.TweenProperty(_meshNode, "scale", bounceScale, 0.1);
                tween.Parallel().TweenProperty(_meshNode, "position", bouncePos, 0.1);

                // Settle back to original
                tween.TweenProperty(_meshNode, "scale", originalScale, 0.15);
                tween.Parallel().TweenProperty(_meshNode, "position", originalPos, 0.15);

                tween.Finished += () => _isAnimating = false;
            }
        }
    }
}
