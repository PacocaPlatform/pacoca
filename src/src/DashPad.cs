using Godot;
using System;

public partial class DashPad : Area3D
{
    [Export] public float BoostForce = 32.0f;
    [Export] public Vector3 BoostDirection = Vector3.Right;
    [Export] public float ControlLockDuration = 0.4f;

    private MeshInstance3D? _meshInstance;
    private CpuParticles3D? _boostParticles;
    private bool _isAnimating = false;

    public override void _Ready()
    {
        _meshInstance = GetNodeOrNull<MeshInstance3D>("MeshInstance3D");
        _boostParticles = GetNodeOrNull<CpuParticles3D>("BoostParticles");
        BodyEntered += OnBodyEntered;
        BoostDirection = BoostDirection.Normalized();
    }

    private void OnBodyEntered(Node3D body)
    {
        if (body is Player player)
        {
            // Calculate and apply boost
            Vector3 boostVel = BoostDirection * BoostForce;
            player.ApplyBoost(boostVel, ControlLockDuration);
            player.IsRolling = true; // Force into roll ball form

            // Particle effect
            if (_boostParticles != null)
            {
                _boostParticles.Restart();
                _boostParticles.Emitting = true;
            }

            // Pulsing Material emission for visual feedback
            if (_meshInstance != null && !_isAnimating)
            {
                _isAnimating = true;
                
                // Fetch the material (we assume the mesh has a StandardMaterial3D at index 0)
                Material mat = _meshInstance.GetActiveMaterial(0);
                if (mat is StandardMaterial3D stdMat)
                {
                    // Enable emission if not already
                    stdMat.EmissionEnabled = true;
                    float originalEnergy = stdMat.EmissionEnergyMultiplier;

                    Tween tween = CreateTween();
                    // Flash emission energy bright
                    tween.TweenProperty(stdMat, "emission_energy_multiplier", originalEnergy + 5.0f, 0.05);
                    // Fade back to normal
                    tween.TweenProperty(stdMat, "emission_energy_multiplier", originalEnergy, 0.3);
                    tween.Finished += () => _isAnimating = false;
                }
                else
                {
                    _isAnimating = false;
                }
            }
        }
    }
}
