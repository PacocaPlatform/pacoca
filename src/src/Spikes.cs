using Godot;
using System;

public partial class Spikes : Area3D
{
    public override void _Ready()
    {
        BodyEntered += OnBodyEntered;
    }

    private void OnBodyEntered(Node3D body)
    {
        if (body is Player player)
        {
            player.Hurt(GlobalPosition);
        }
    }
}
