using Godot;
using System;

public partial class Main : Node3D
{
    [Export] public string LevelToLoad = "res://scenes/levels/level_01.tscn";

    private Node3D _levelWrapper = null!;
    private Player _player = null!;
    private CameraController _camera = null!;
    private LevelFinishScreen _finishScreen = null!;

    // Background music player (gameplay theme)
    private AudioStreamPlayer _musicPlayer = null!;

    public override void _Ready()
    {
        ApplyCmdlineLevelOverride();

        _levelWrapper = GetNode<Node3D>("LevelWrapper");
        _player = GetNode<Player>("Player");
        _camera = GetNode<CameraController>("Camera3D");
        _finishScreen = GetNode<LevelFinishScreen>("HUDLayer/LevelFinishScreen");

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

    // Lets the map editor's "Testar fase" button launch straight into a level:
    //   Godot --path src scenes/main.tscn -- --level=04
    //   Godot --path src scenes/main.tscn -- --level=res://scenes/levels/level_04.tscn
    private void ApplyCmdlineLevelOverride()
    {
        foreach (string arg in OS.GetCmdlineUserArgs())
        {
            if (!arg.StartsWith("--level=")) continue;

            string val = arg.Substring("--level=".Length).Trim();
            if (string.IsNullOrEmpty(val)) continue;

            string path = val.StartsWith("res://")
                ? val
                : $"res://scenes/levels/level_{val}.tscn";
            GameSettings.LevelToLoad = path;
            // The menu didn't run, so its theme choice (if any) is stale.
            GameSettings.LevelTheme = "";
            GD.Print($"Main.cs: Level override from cmdline -> {path}");
        }
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

        // After the camera snapped: the backdrop anchors to its rest height.
        SetupParallaxBackground(levelInstance, levelPath);
    }

    // Swaps the legacy stretched BG_Mountains quad for the camera-following
    // parallax backdrop, themed after the level. Runs on every level (old,
    // hand-made, or map-editor output) without requiring a recompile.
    private void SetupParallaxBackground(Node3D levelInstance, string levelPath)
    {
        var oldBg = levelInstance.GetNodeOrNull<MeshInstance3D>("Level/BG_Mountains");
        if (oldBg != null)
        {
            oldBg.Visible = false;
        }

        var backdrop = new ParallaxBackground3D();
        backdrop.Name = "ParallaxBackdrop";
        backdrop.LevelTheme = DetectLevelTheme(levelPath);
        levelInstance.AddChild(backdrop);
    }

    // Theme priority: menu selection > levels.json manifest (map-editor test
    // runs bypass the menu) > filename convention > forest.
    private static string DetectLevelTheme(string levelPath)
    {
        if (!string.IsNullOrEmpty(GameSettings.LevelTheme))
        {
            return GameSettings.LevelTheme;
        }

        const string manifestPath = "res://scenes/levels/levels.json";
        if (Godot.FileAccess.FileExists(manifestPath))
        {
            using var file = Godot.FileAccess.Open(manifestPath, Godot.FileAccess.ModeFlags.Read);
            var parsed = Json.ParseString(file.GetAsText());
            if (parsed.VariantType == Variant.Type.Dictionary &&
                parsed.AsGodotDictionary().TryGetValue("levels", out var levelsVar))
            {
                foreach (var item in levelsVar.AsGodotArray())
                {
                    var dict = item.AsGodotDictionary();
                    if (dict.TryGetValue("scene", out var scene) && scene.AsString() == levelPath &&
                        dict.TryGetValue("theme", out var theme))
                    {
                        return theme.AsString();
                    }
                }
            }
        }

        string fileName = levelPath.GetFile();
        foreach (string t in new[] { "glacial", "cidade", "caverna" })
        {
            if (fileName.StartsWith($"level_{t}_")) return t;
        }
        return "forest";
    }

    public void RestartStage()
    {
        LoadLevel();
    }

    public void CompleteLevel(int rings, int score, double timeElapsed)
    {
        // Stop background gameplay music with fade out
        if (_musicPlayer != null && _musicPlayer.Playing)
        {
            var fade = CreateTween();
            fade.TweenProperty(_musicPlayer, "volume_db", -40.0f, 0.8f);
            fade.TweenCallback(Callable.From(() => _musicPlayer.Stop()));
        }

        // Display completion statistics overlay screen
        _finishScreen.ShowScreen(rings, score, timeElapsed);
    }
}

