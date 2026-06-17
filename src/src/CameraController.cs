using Godot;
using System;

public partial class CameraController : Camera3D
{
	[Export] public NodePath TargetPath = null!;
	[Export] public float FollowSpeed = 6.0f;
	[Export] public Vector2 Offset = new Vector2(2.0f, 1.5f); // Look slightly ahead of player

	private Node3D? _target;
	private float _originalZ;

	public override void _Ready()
	{
		if (TargetPath != null)
		{
			_target = GetNodeOrNull<Node3D>(TargetPath);
		}
		
		// Save initial Z distance
		_originalZ = GlobalPosition.Z;
	}

	public override void _PhysicsProcess(double delta)
	{
		if (_target == null) return;

		float fDelta = (float)delta;
		Vector3 targetPos = _target.GlobalPosition;

		// Smoothly interpolate the X and Y coordinates to track the player, plus offset
		// In Sonic, we offset the camera in the direction of the player's movement
		Vector3 playerVel = Vector3.Zero;
		if (_target is Player player)
		{
			playerVel = player.Velocity;
		}

		float leadX = Mathf.Clamp(playerVel.X * 0.15f, -3.0f, 3.0f);
		Vector3 targetCameraPos = new Vector3(
			targetPos.X + Offset.X + leadX,
			targetPos.Y + Offset.Y,
			_originalZ
		);

		// Keep camera bound within level limits (optional, but prevents going below ground)
		if (targetCameraPos.Y < 2.0f)
		{
			targetCameraPos.Y = 2.0f;
		}

		GlobalPosition = GlobalPosition.Lerp(targetCameraPos, FollowSpeed * fDelta);
	}
}
