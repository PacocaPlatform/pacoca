using Godot;
using System;

public partial class Main : Node3D
{
    [Export] public string LevelToLoad = "res://scenes/levels/level_01.tscn";

    private Node3D _levelWrapper = null!;
    private Player _player = null!;
    private CameraController _camera = null!;

    // Background music player (gameplay theme)
    private AudioStreamPlayer _musicPlayer = null!;

    public override void _Ready()
    {
        _levelWrapper = GetNode<Node3D>("LevelWrapper");
        _player = GetNode<Player>("Player");
        _camera = GetNode<CameraController>("Camera3D");

        // Setup background music (gameplay theme), routed through the shared "Music" bus
        // controlled by the options volume slider. volume_db is used as a fade envelope.
        GameSettings.EnsureMusicBus();
        _musicPlayer = new AudioStreamPlayer();
        _musicPlayer.Bus = "Music";
        AddChild(_musicPlayer);
        var gameplayMusic = GameSettings.LoadMusic("res://audio/game-play-01.mp3");
        if (gameplayMusic is AudioStreamMP3 mp3)
        {
            mp3.Loop = true;
        }
        _musicPlayer.Stream = gameplayMusic;
        _musicPlayer.VolumeDb = -40.0f;
        _musicPlayer.Play();
        var fade = CreateTween();
        fade.TweenProperty(_musicPlayer, "volume_db", 0.0f, 1.0f);

        LoadLevel();
    }

    private void LoadLevel()
    {
        string levelPath = GameSettings.LevelToLoad;
        if (string.IsNullOrEmpty(levelPath))
        {
            levelPath = LevelToLoad;
        }

        if (string.IsNullOrEmpty(levelPath))
        {
            GD.PrintErr("Main.cs: Level path is not set.");
            return;
        }

        // Clean up any existing level inside the wrapper
        foreach (Node child in _levelWrapper.GetChildren())
        {
            child.QueueFree();
        }

        // Load and instance the new level scene
        var levelScene = GD.Load<PackedScene>(levelPath);
        if (levelScene == null)
        {
            GD.PrintErr($"Main.cs: Failed to load level scene at path '{levelPath}'");
            return;
        }

        var levelInstance = levelScene.Instantiate<Node3D>();
        _levelWrapper.AddChild(levelInstance);

        // Find SpawnPoint (Marker3D) inside the loaded level
        var spawnPoint = levelInstance.GetNodeOrNull<Marker3D>("SpawnPoint");
        if (spawnPoint != null)
        {
            // Set Player position to spawn point
            _player.GlobalPosition = spawnPoint.GlobalPosition;
            _player.SpawnPosition = spawnPoint.GlobalPosition;
        }
        else
        {
            GD.Print("Main.cs: SpawnPoint not found in level scene. Using default spawn position.");
        }

        // Reset camera limits and immediately snap the camera
        _camera.ResetCameraLimits();
    }

    public void RestartStage()
    {
        LoadLevel();
    }
}

