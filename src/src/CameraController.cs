using Godot;
using System;

public partial class CameraController : Camera3D
{
	[Export] public NodePath TargetPath = null!;
	[Export] public float FollowSpeed = 6.0f;
	[Export] public Vector2 Offset = new Vector2(2.0f, 1.5f); // Look slightly ahead of player

	private Node3D? _target;
	private float _originalZ;
	private float _minX;
	private bool _limitsInitialized = false;

	public override void _Ready()
	{
		if (TargetPath != null)
		{
			_target = GetNodeOrNull<Node3D>(TargetPath);
		}
		
		// Save initial Z distance
		_originalZ = GlobalPosition.Z;
	}

	public void ResetCameraLimits()
	{
		if (_target == null) return;
		_minX = _target.GlobalPosition.X + Offset.X;
		_limitsInitialized = true;

		Vector3 targetCameraPos = new Vector3(
			_minX,
			_target.GlobalPosition.Y + Offset.Y,
			_originalZ
		);
		if (targetCameraPos.Y < 2.0f)
		{
			targetCameraPos.Y = 2.0f;
		}
		GlobalPosition = targetCameraPos;
	}

	public float GetLeftBoundaryX()
	{
		float fovRad = Mathf.DegToRad(Fov);
		float distance = Mathf.Abs(GlobalPosition.Z);
		float halfHeight = distance * Mathf.Tan(fovRad / 2.0f);
		
		float aspect = 16.0f / 9.0f;
		if (GetViewport() != null)
		{
			var rect = GetViewport().GetVisibleRect();
			if (rect.Size.Y > 0)
			{
				aspect = rect.Size.X / rect.Size.Y;
			}
		}
		
		float halfWidth = halfHeight * aspect;
		return GlobalPosition.X - halfWidth;
	}

	public override void _PhysicsProcess(double delta)
	{
		if (_target == null) return;

		if (!_limitsInitialized)
		{
			ResetCameraLimits();
		}

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

		// Clamp the camera's target position to the left limit
		if (targetCameraPos.X < _minX)
		{
			targetCameraPos.X = _minX;
		}

		// Keep camera bound within level limits (optional, but prevents going below ground)
		if (targetCameraPos.Y < 2.0f)
		{
			targetCameraPos.Y = 2.0f;
		}

		GlobalPosition = GlobalPosition.Lerp(targetCameraPos, FollowSpeed * fDelta);

		// Enforce limit strictly
		if (GlobalPosition.X < _minX)
		{
			Vector3 currentPos = GlobalPosition;
			currentPos.X = _minX;
			GlobalPosition = currentPos;
		}
	}
}
