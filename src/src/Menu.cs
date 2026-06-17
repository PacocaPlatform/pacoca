using Godot;
using System;

public partial class Menu : Node3D
{
    private Button _startButton = null!;
    private Button _configButton = null!;
    private Button _exitButton = null!;
    
    private Button _backButton = null!;
    private Button _mapButton = null!;
    private OptionButton _joyOptionButton = null!;
    private Label _mapInstructionsLabel = null!;
    
    private PanelContainer _mainMenuPanel = null!;
    private PanelContainer _configPanel = null!;
    private PanelContainer _levelPanel = null!;

    private Button _level1Button = null!;
    private Button _debugLevelButton = null!;
    private Button _levelBackButton = null!;
    
    private Node3D _playerVisuals = null!;
    private float _animationTime = 0.0f;
    private bool _isMappingInput = false;

    // Procedural sound effects player
    private AudioStreamPlayer _audioPlayer = null!;
    private AudioStreamGeneratorPlayback? _audioPlayback;

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

        // Main Menu references
        _startButton = GetNode<Button>("CanvasLayer/Control/MarginContainer/MainMenuPanel/MarginContainer/VBoxContainer/StartButton");
        _configButton = GetNode<Button>("CanvasLayer/Control/MarginContainer/MainMenuPanel/MarginContainer/VBoxContainer/ConfigButton");
        _exitButton = GetNode<Button>("CanvasLayer/Control/MarginContainer/MainMenuPanel/MarginContainer/VBoxContainer/ExitButton");
        _mainMenuPanel = GetNode<PanelContainer>("CanvasLayer/Control/MarginContainer/MainMenuPanel");

        // Config Menu references
        _backButton = GetNode<Button>("CanvasLayer/Control/MarginContainer/ConfigPanel/MarginContainer/VBoxContainer/BackButton");
        _mapButton = GetNode<Button>("CanvasLayer/Control/MarginContainer/ConfigPanel/MarginContainer/VBoxContainer/MapButton");
        _joyOptionButton = GetNode<OptionButton>("CanvasLayer/Control/MarginContainer/ConfigPanel/MarginContainer/VBoxContainer/JoyOptionButton");
        _mapInstructionsLabel = GetNode<Label>("CanvasLayer/Control/MarginContainer/ConfigPanel/MarginContainer/VBoxContainer/MapInstructionsLabel");
        _configPanel = GetNode<PanelContainer>("CanvasLayer/Control/MarginContainer/ConfigPanel");

        // Level Panel references
        _level1Button = GetNode<Button>("CanvasLayer/Control/MarginContainer/LevelPanel/MarginContainer/VBoxContainer/Level1Button");
        _debugLevelButton = GetNode<Button>("CanvasLayer/Control/MarginContainer/LevelPanel/MarginContainer/VBoxContainer/DebugLevelButton");
        _levelBackButton = GetNode<Button>("CanvasLayer/Control/MarginContainer/LevelPanel/MarginContainer/VBoxContainer/LevelBackButton");
        _levelPanel = GetNode<PanelContainer>("CanvasLayer/Control/MarginContainer/LevelPanel");

        _playerVisuals = GetNode<Node3D>("PlayerVisuals");

        // Toggle initial panel visibility
        _mainMenuPanel.Visible = true;
        _configPanel.Visible = false;
        _levelPanel.Visible = false;
        _mapInstructionsLabel.Visible = false;

        // Grab focus on the start button for keyboard/joystick navigation immediately
        _startButton.GrabFocus();

        // Connect button press events
        _startButton.Pressed += OnStartPressed;
        _configButton.Pressed += OnConfigPressed;
        _exitButton.Pressed += OnExitPressed;
        _backButton.Pressed += OnBackPressed;
        _mapButton.Pressed += OnMapButtonPressed;
        _joyOptionButton.ItemSelected += OnJoypadSelected;

        // Connect Level Panel buttons
        _level1Button.Pressed += OnLevel1Pressed;
        _debugLevelButton.Pressed += OnDebugLevelPressed;
        _levelBackButton.Pressed += OnLevelBackPressed;

        // Populate joystick dropdown
        PopulateJoypads();

        // Connect Joypad connection events dynamically
        Input.Singleton.JoyConnectionChanged += OnJoyConnectionChanged;

        // Connect procedural sound feedback recursively
        ConnectUIFeedback(GetNode("CanvasLayer/Control"));
    }

    public override void _ExitTree()
    {
        // Unsubscribe to avoid memory leaks
        Input.Singleton.JoyConnectionChanged -= OnJoyConnectionChanged;
    }

    private void ConnectUIFeedback(Node node)
    {
        if (node is Button btn)
        {
            // Play short high-frequency tick when focused
            btn.FocusEntered += () => PlaySound(880f, 0.03f, 0.1f);
            
            // Hover automatically grabs focus for mouse navigation
            btn.MouseEntered += () => {
                if (!_isMappingInput && !btn.Disabled)
                    btn.GrabFocus();
            };
        }
        else if (node is OptionButton optBtn)
        {
            optBtn.FocusEntered += () => PlaySound(880f, 0.03f, 0.1f);
            optBtn.MouseEntered += () => {
                if (!_isMappingInput && !optBtn.Disabled)
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
        // Animate background T-Rex character gently (idle breathe)
        _animationTime += (float)delta * 2.0f;
        float breath = Mathf.Sin(_animationTime);
        
        var bodyNode = _playerVisuals.GetNodeOrNull<Node3D>("Body");
        var headNode = _playerVisuals.GetNodeOrNull<Node3D>("Body/Head");
        var tailNode = _playerVisuals.GetNodeOrNull<Node3D>("Body/Tail");

        if (bodyNode != null)
        {
            bodyNode.Scale = new Vector3(1.0f, 1.0f + breath * 0.02f, 1.0f);
        }
        if (headNode != null)
        {
            headNode.Rotation = new Vector3(0, 0, breath * 0.03f);
        }
        if (tailNode != null)
        {
            tailNode.Rotation = new Vector3(0, breath * 0.1f, breath * 0.05f);
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
        _mainMenuPanel.Visible = false;
        _levelPanel.Visible = true;
        _level1Button.GrabFocus();
    }

    private void OnLevel1Pressed()
    {
        PlaySound(1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = "res://scenes/levels/level_01.tscn";
        GetTree().ChangeSceneToFile("res://scenes/main.tscn");
    }

    private void OnDebugLevelPressed()
    {
        PlaySound(1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = "res://scenes/levels/debug.tscn";
        GetTree().ChangeSceneToFile("res://scenes/main.tscn");
    }

    private void OnLevelBackPressed()
    {
        PlaySound(392.00f, 0.1f, 0.3f); // G4 note back sound
        _mainMenuPanel.Visible = true;
        _levelPanel.Visible = false;
        _startButton.GrabFocus();
    }

    private void OnConfigPressed()
    {
        PlaySound(523.25f, 0.1f, 0.3f); // C5 note sound
        _mainMenuPanel.Visible = false;
        _configPanel.Visible = true;
        _joyOptionButton.GrabFocus();
    }

    private void OnBackPressed()
    {
        PlaySound(392.00f, 0.1f, 0.3f); // G4 note back sound
        _mainMenuPanel.Visible = true;
        _configPanel.Visible = false;
        _configButton.GrabFocus();
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
        _backButton.Disabled = disabled;
        _joyOptionButton.Disabled = disabled;
        _mapButton.Disabled = disabled;

        _level1Button.Disabled = disabled;
        _debugLevelButton.Disabled = disabled;
        _levelBackButton.Disabled = disabled;
    }

    private void OnExitPressed()
    {
        PlaySound(261.63f, 0.2f, 0.3f); // C4 note quit sound
        GetTree().CreateTimer(0.25f).Timeout += () => GetTree().Quit();
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
