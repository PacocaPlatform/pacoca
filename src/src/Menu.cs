using Godot;
using System;
using System.Collections.Generic;

public partial class Menu : Control
{
    private Button _startButton = null!;
    private Button _configButton = null!;
    private Button _exitButton = null!;
    private Button _creditsButton = null!;
    
    private Button _trophyButton = null!;
    private Button _gearButton = null!;
    
    private Button _backButton = null!;
    private Button _mapButton = null!;
    private OptionButton _joyOptionButton = null!;
    private Label _mapInstructionsLabel = null!;
    
    private PanelContainer _configPanel = null!;
    private PanelContainer _levelPanel = null!;
    private PanelContainer _creditsPanel = null!;
    private PanelContainer _achievementsPanel = null!;

    private Button _level1Button = null!;
    private Button _level2Button = null!;
    private Button _level3Button = null!;
    private Button _platformKitDemoButton = null!;
    private Button _debugLevelButton = null!;
    private Button _levelBackButton = null!;
    
    private Button _creditsBackButton = null!;
    private Button _achievementsBackButton = null!;

    private bool _isMappingInput = false;

    // Procedural sound effects player
    private AudioStreamPlayer _audioPlayer = null!;
    private AudioStreamGeneratorPlayback? _audioPlayback;

    // Background music player (title theme)
    private AudioStreamPlayer _musicPlayer = null!;
    private HSlider _musicVolumeSlider = null!;

    // Fade envelope constants (applied to the music player's volume_db)
    private const float MusicSilentDb = -40.0f;
    private const float MusicFadeTime = 1.0f;

    // List of buttons to animate focus scale
    private List<Button> _animatedButtons = new();

    public override void _Ready()
    {
        // Setup procedural audio player
        _audioPlayer = new AudioStreamPlayer();
        AddChild(_audioPlayer);
        var generator = new AudioStreamGenerator();
        generator.MixRate = 44100.0f;
        generator.BufferLength = 0.1f;
        _audioPlayer.Stream = generator;
        _audioPlayer.Play();
        _audioPlayback = _audioPlayer.GetStreamPlayback() as AudioStreamGeneratorPlayback;

        // Setup background music (title theme), routed through the "Music" bus so the
        // volume slider controls it globally. The player's own volume_db is used purely
        // as a fade envelope.
        GameSettings.EnsureMusicBus();
        _musicPlayer = new AudioStreamPlayer();
        _musicPlayer.Bus = "Music";
        AddChild(_musicPlayer);
        var menuMusic = GameSettings.LoadMusic("res://audio/menu.mp3");
        if (menuMusic is AudioStreamMP3 mp3)
        {
            mp3.Loop = true;
        }
        _musicPlayer.Stream = menuMusic;
        _musicPlayer.VolumeDb = MusicSilentDb;
        _musicPlayer.Play();
        FadeMusic(0.0f, MusicFadeTime);

        // Main Menu references
        _startButton = GetNode<Button>("MainMenuContainer/JogarButton");
        _configButton = GetNode<Button>("MainMenuContainer/OpcoesButton");
        _creditsButton = GetNode<Button>("MainMenuContainer/CreditosButton");
        _exitButton = GetNode<Button>("MainMenuContainer/SairButton");
        
        // Corner Button references
        _trophyButton = GetNode<Button>("TopLeftContainer/TrophyButton");
        _gearButton = GetNode<Button>("TopRightContainer/GearButton");

        // Config Menu references
        _backButton = GetNode<Button>("ConfigPanel/MarginContainer/VBoxContainer/BackButton");
        _mapButton = GetNode<Button>("ConfigPanel/MarginContainer/VBoxContainer/MapButton");
        _joyOptionButton = GetNode<OptionButton>("ConfigPanel/MarginContainer/VBoxContainer/JoyOptionButton");
        _mapInstructionsLabel = GetNode<Label>("ConfigPanel/MarginContainer/VBoxContainer/MapInstructionsLabel");
        _configPanel = GetNode<PanelContainer>("ConfigPanel");
        _musicVolumeSlider = GetNode<HSlider>("ConfigPanel/MarginContainer/VBoxContainer/MusicVolumeSlider");
        _musicVolumeSlider.Value = GameSettings.MusicVolume;
        _musicVolumeSlider.ValueChanged += OnMusicVolumeChanged;

        // Level Panel references
        _level1Button = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/Level1Button");
        _level2Button = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/Level2Button");
        _level3Button = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/Level3Button");
        _platformKitDemoButton = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/PlatformKitDemoButton");
        _debugLevelButton = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/DebugLevelButton");
        _levelBackButton = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/LevelBackButton");
        _levelPanel = GetNode<PanelContainer>("LevelPanel");

        // Credits Panel references
        _creditsPanel = GetNode<PanelContainer>("CreditsPanel");
        _creditsBackButton = GetNode<Button>("CreditsPanel/MarginContainer/VBoxContainer/CreditsBackButton");

        // Achievements Panel references
        _achievementsPanel = GetNode<PanelContainer>("AchievementsPanel");
        _achievementsBackButton = GetNode<Button>("AchievementsPanel/MarginContainer/VBoxContainer/AchievementsBackButton");

        // Populating animated button list
        _animatedButtons.Add(_startButton);
        _animatedButtons.Add(_configButton);
        _animatedButtons.Add(_creditsButton);
        _animatedButtons.Add(_exitButton);
        _animatedButtons.Add(_trophyButton);
        _animatedButtons.Add(_gearButton);
        _animatedButtons.Add(_backButton);
        _animatedButtons.Add(_mapButton);
        _animatedButtons.Add(_level1Button);
        _animatedButtons.Add(_level2Button);
        _animatedButtons.Add(_level3Button);
        _animatedButtons.Add(_platformKitDemoButton);
        _animatedButtons.Add(_debugLevelButton);
        _animatedButtons.Add(_levelBackButton);
        _animatedButtons.Add(_creditsBackButton);
        _animatedButtons.Add(_achievementsBackButton);

        foreach (var btn in _animatedButtons)
        {
            // Set pivot offset to center for scale zoom
            btn.PivotOffset = btn.CustomMinimumSize / 2.0f;
        }

        // Toggle initial panel visibility
        SetMainMenuVisible(true);
        _configPanel.Visible = false;
        _levelPanel.Visible = false;
        _creditsPanel.Visible = false;
        _achievementsPanel.Visible = false;
        _mapInstructionsLabel.Visible = false;

        // Grab focus on the start button for keyboard/joystick navigation immediately
        _startButton.GrabFocus();

        // Connect button press events
        _startButton.Pressed += OnStartPressed;
        _configButton.Pressed += OnConfigPressed;
        _creditsButton.Pressed += OnCreditsPressed;
        _exitButton.Pressed += OnExitPressed;
        
        _trophyButton.Pressed += OnTrophyPressed;
        _gearButton.Pressed += OnGearPressed;

        _backButton.Pressed += OnBackPressed;
        _mapButton.Pressed += OnMapButtonPressed;
        _joyOptionButton.ItemSelected += OnJoypadSelected;

        _level1Button.Pressed += OnLevel1Pressed;
        _level2Button.Pressed += OnLevel2Pressed;
        _level3Button.Pressed += OnLevel3Pressed;
        _platformKitDemoButton.Pressed += OnPlatformKitDemoPressed;
        _debugLevelButton.Pressed += OnDebugLevelPressed;
        _levelBackButton.Pressed += OnLevelBackPressed;
        
        _creditsBackButton.Pressed += OnCreditsBackPressed;
        _achievementsBackButton.Pressed += OnAchievementsBackPressed;

        // Populate joystick dropdown
        PopulateJoypads();

        // Connect Joypad connection events dynamically
        Input.Singleton.JoyConnectionChanged += OnJoyConnectionChanged;

        // Connect procedural sound feedback recursively
        ConnectUIFeedback(this);
    }

    public override void _ExitTree()
    {
        // Unsubscribe to avoid memory leaks
        Input.Singleton.JoyConnectionChanged -= OnJoyConnectionChanged;
    }

    private void SetMainMenuVisible(bool visible)
    {
        GetNode<Control>("MainMenuContainer").Visible = visible;
        GetNode<Control>("TopLeftContainer").Visible = visible;
        GetNode<Control>("TopRightContainer").Visible = visible;
    }

    private void ConnectUIFeedback(Node node)
    {
        if (node is Button btn)
        {
            // Play short high-frequency tick when focused
            btn.FocusEntered += () => PlaySound(880f, 0.03f, 0.1f);
            
            // Hover automatically grabs focus for mouse navigation
            btn.MouseEntered += () => {
                if (!_isMappingInput && !btn.Disabled && btn.Visible)
                    btn.GrabFocus();
            };
        }
        else if (node is OptionButton optBtn)
        {
            optBtn.FocusEntered += () => PlaySound(880f, 0.03f, 0.1f);
            optBtn.MouseEntered += () => {
                if (!_isMappingInput && !optBtn.Disabled && optBtn.Visible)
                    optBtn.GrabFocus();
            };
        }

        foreach (Node child in node.GetChildren())
        {
            ConnectUIFeedback(child);
        }
    }

    public override void _Process(double delta)
    {
        // Handle focus scaling animation
        foreach (var btn in _animatedButtons)
        {
            if (btn.Visible && btn.GetParent() is Control parent && parent.Visible)
            {
                float targetScale = (btn.HasFocus() || btn.IsHovered()) ? 1.08f : 1.0f;
                btn.Scale = btn.Scale.Lerp(new Vector2(targetScale, targetScale), (float)delta * 12.0f);
            }
            else
            {
                btn.Scale = Vector2.One;
            }
        }
    }

    private void PopulateJoypads()
    {
        _joyOptionButton.Clear();
        
        // Item 0: Default Option
        _joyOptionButton.AddItem("Todos / Padrão (Auto)");
        _joyOptionButton.SetItemMetadata(0, -1);

        var joypads = Input.GetConnectedJoypads();
        int selectedIndex = 0;

        for (int i = 0; i < joypads.Count; i++)
        {
            int joyId = joypads[i];
            string name = Input.GetJoyName(joyId);
            string displayText = $"Controle {joyId}: {name}";
            
            _joyOptionButton.AddItem(displayText);
            _joyOptionButton.SetItemMetadata(i + 1, joyId);

            if (joyId == GameSettings.SelectedJoypadId)
            {
                selectedIndex = i + 1;
            }
        }

        // Select currently active joypad in dropdown
        _joyOptionButton.Select(selectedIndex);
    }

    private void OnJoyConnectionChanged(long device, bool connected)
    {
        // Re-populate dropdown when controllers are plugged in/out
        PopulateJoypads();
    }

    private void OnJoypadSelected(long index)
    {
        int joyId = (int)_joyOptionButton.GetItemMetadata((int)index);
        GameSettings.SelectedJoypadId = joyId;
        GameSettings.ApplyJoypadSettings();
        PlaySound(587.33f, 0.1f, 0.3f); // D5 note sound
    }

    private void OnStartPressed()
    {
        PlaySound(523.25f, 0.1f, 0.3f); // C5 note sound
        SetMainMenuVisible(false);
        _levelPanel.Visible = true;
        _level1Button.GrabFocus();
    }

    private void OnLevel1Pressed()
    {
        PlaySound(1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = "res://scenes/levels/level_01.tscn";
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnLevel2Pressed()
    {
        PlaySound(1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = "res://scenes/levels/level_02.tscn";
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnLevel3Pressed()
    {
        PlaySound(1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = "res://scenes/levels/level_03.tscn";
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnPlatformKitDemoPressed()
    {
        PlaySound(1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = "res://scenes/levels/platform_kit_demo.tscn";
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnDebugLevelPressed()
    {
        PlaySound(1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = "res://scenes/levels/debug.tscn";
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnLevelBackPressed()
    {
        PlaySound(392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _levelPanel.Visible = false;
        _startButton.GrabFocus();
    }

    private void OnConfigPressed()
    {
        PlaySound(523.25f, 0.1f, 0.3f); // C5 note sound
        SetMainMenuVisible(false);
        _configPanel.Visible = true;
        _joyOptionButton.GrabFocus();
    }

    private void OnGearPressed()
    {
        OnConfigPressed();
    }

    private void OnBackPressed()
    {
        PlaySound(392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _configPanel.Visible = false;
        _configButton.GrabFocus();
    }

    private void OnCreditsPressed()
    {
        PlaySound(523.25f, 0.1f, 0.3f); // C5 note sound
        SetMainMenuVisible(false);
        _creditsPanel.Visible = true;
        _creditsBackButton.GrabFocus();
    }

    private void OnCreditsBackPressed()
    {
        PlaySound(392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _creditsPanel.Visible = false;
        _creditsButton.GrabFocus();
    }

    private void OnTrophyPressed()
    {
        PlaySound(523.25f, 0.1f, 0.3f); // C5 note sound
        SetMainMenuVisible(false);
        _achievementsPanel.Visible = true;
        _achievementsBackButton.GrabFocus();
    }

    private void OnAchievementsBackPressed()
    {
        PlaySound(392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _achievementsPanel.Visible = false;
        _trophyButton.GrabFocus();
    }

    private void OnMapButtonPressed()
    {
        PlaySound(523.25f, 0.1f, 0.3f); // C5 note sound
        _isMappingInput = true;
        
        _mapInstructionsLabel.Text = "Aperte qualquer botão no seu controle...";
        _mapInstructionsLabel.Visible = true;

        // Disable UI interactions during learning mode
        ToggleButtonsDisabled(true);
    }

    public override void _Input(InputEvent @event)
    {
        if (_isMappingInput && @event is InputEventJoypadButton joyBtn && joyBtn.Pressed)
        {
            // Consume the input event to prevent triggering other actions
            GetViewport().SetInputAsHandled();

            int deviceId = joyBtn.Device;
            int buttonId = (int)joyBtn.ButtonIndex;

            // Lock settings to this specific controller device ID if it was on Auto/All (-1)
            if (GameSettings.SelectedJoypadId == -1)
            {
                GameSettings.SelectedJoypadId = deviceId;
                PopulateJoypads(); // Refresh dropdown to show locked device
            }

            // Remap jump and ui_accept dynamically
            RebindActionJoystickButton("ui_accept", buttonId);
            RebindActionJoystickButton("jump", buttonId);

            // Re-apply settings
            GameSettings.ApplyJoypadSettings();

            // Success feedback
            _mapInstructionsLabel.Text = $"Botão {buttonId} configurado para Ação/Pulo!";
            PlaySound(880.0f, 0.25f, 0.4f); // High confirmation beep

            // Wait 1.5 seconds and return UI control
            var timer = GetTree().CreateTimer(1.5f);
            timer.Timeout += () =>
            {
                _mapInstructionsLabel.Visible = false;
                _isMappingInput = false;
                ToggleButtonsDisabled(false);
                _mapButton.GrabFocus();
            };
        }
    }

    private void RebindActionJoystickButton(string action, int buttonId)
    {
        if (!InputMap.HasAction(action)) return;

        // Remove existing joystick button mappings for this action
        var events = InputMap.ActionGetEvents(action);
        foreach (var ev in events)
        {
            if (ev is InputEventJoypadButton)
            {
                InputMap.ActionEraseEvent(action, ev);
            }
        }

        // Add the new button mapping
        var newEvent = new InputEventJoypadButton();
        newEvent.Device = GameSettings.SelectedJoypadId;
        newEvent.ButtonIndex = (JoyButton)buttonId;
        InputMap.ActionAddEvent(action, newEvent);
    }

    private void ToggleButtonsDisabled(bool disabled)
    {
        _startButton.Disabled = disabled;
        _configButton.Disabled = disabled;
        _exitButton.Disabled = disabled;
        _creditsButton.Disabled = disabled;
        _trophyButton.Disabled = disabled;
        _gearButton.Disabled = disabled;
        
        _backButton.Disabled = disabled;
        _joyOptionButton.Disabled = disabled;
        _mapButton.Disabled = disabled;

        _level1Button.Disabled = disabled;
        _level2Button.Disabled = disabled;
        _level3Button.Disabled = disabled;
        _platformKitDemoButton.Disabled = disabled;
        _debugLevelButton.Disabled = disabled;
        _levelBackButton.Disabled = disabled;
        
        _creditsBackButton.Disabled = disabled;
        _achievementsBackButton.Disabled = disabled;
    }

    private void OnExitPressed()
    {
        PlaySound(261.63f, 0.2f, 0.3f); // C4 note quit sound
        GetTree().CreateTimer(0.25f).Timeout += () => GetTree().Quit();
    }

    private void OnMusicVolumeChanged(double value)
    {
        GameSettings.MusicVolume = (float)value;
        GameSettings.ApplyMusicVolume();
    }

    // Tweens the music player's volume_db (fade envelope) toward targetDb.
    private void FadeMusic(float targetDb, float duration)
    {
        var tween = CreateTween();
        tween.TweenProperty(_musicPlayer, "volume_db", targetDb, duration);
    }

    // Fades the title music out, then switches scenes.
    private async void ChangeSceneWithFade(string scenePath)
    {
        var tween = CreateTween();
        tween.TweenProperty(_musicPlayer, "volume_db", MusicSilentDb, 0.6f);
        await ToSignal(tween, Tween.SignalName.Finished);
        GetTree().ChangeSceneToFile(scenePath);
    }

    // Procedural sound helper
    public void PlaySound(float frequency, float duration, float volume = 0.5f)
    {
        if (_audioPlayback == null) return;

        float sampleRate = 44100.0f;
        int numSamples = (int)(sampleRate * duration);
        float phase = 0.0f;
        float phaseIncrement = (2.0f * Mathf.Pi * frequency) / sampleRate;

        for (int i = 0; i < numSamples; i++)
        {
            if (_audioPlayback.GetFramesAvailable() > 0)
            {
                float envelope = (float)(numSamples - i) / numSamples;
                float sample = Mathf.Sin(phase) * volume * envelope;
                _audioPlayback.PushFrame(new Vector2(sample, sample));
                phase += phaseIncrement;
            }
        }
    }
}
