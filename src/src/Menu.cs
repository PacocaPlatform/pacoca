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
    private Button _level4Button = null!;
    private Button _levelBackButton = null!;
    
    private Button _creditsBackButton = null!;
    private Button _achievementsBackButton = null!;

    // New theme panel and card buttons
    private PanelContainer _themePanel = null!;
    private Button _forestButton = null!;
    private Button _glacialButton = null!;
    private Button _cityButton = null!;
    private Button _caveButton = null!;
    private Button _themeBackButton = null!;

    // Language selector nodes
    private OptionButton _langOptionButton = null!;
    private Label _langLabel = null!;

    // Dynamic sound effects theme selector
    private Label _sfxThemeLabel = null!;
    private OptionButton _sfxThemeOptionButton = null!;
    private AudioStreamPlayer _sfxWavPlayer = null!;

    private string _selectedTheme = "forest";
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
        // Setup WAV sound player
        _sfxWavPlayer = new AudioStreamPlayer();
        _sfxWavPlayer.Bus = "Master";
        AddChild(_sfxWavPlayer);

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

        // Language Option references
        _langOptionButton = GetNode<OptionButton>("ConfigPanel/MarginContainer/VBoxContainer/LangOptionButton");
        _langLabel = GetNode<Label>("ConfigPanel/MarginContainer/VBoxContainer/LangLabel");

        // Dynamically instantiate and style SFX theme selector nodes
        var vbox = GetNode<VBoxContainer>("ConfigPanel/MarginContainer/VBoxContainer");
        
        _sfxThemeLabel = new Label();
        _sfxThemeLabel.Name = "SfxThemeLabel";
        _sfxThemeLabel.LabelSettings = _langLabel.LabelSettings;
        
        _sfxThemeOptionButton = new OptionButton();
        _sfxThemeOptionButton.Name = "SfxThemeOptionButton";
        _sfxThemeOptionButton.CustomMinimumSize = new Vector2(0, 44);
        _sfxThemeOptionButton.Alignment = HorizontalAlignment.Center;
        
        _sfxThemeOptionButton.AddThemeFontOverride("font", _langOptionButton.GetThemeFont("font"));
        _sfxThemeOptionButton.AddThemeFontSizeOverride("font_size", _langOptionButton.GetThemeFontSize("font_size"));
        _sfxThemeOptionButton.AddThemeStyleboxOverride("normal", _langOptionButton.GetThemeStylebox("normal"));
        _sfxThemeOptionButton.AddThemeStyleboxOverride("hover", _langOptionButton.GetThemeStylebox("hover"));
        _sfxThemeOptionButton.AddThemeStyleboxOverride("pressed", _langOptionButton.GetThemeStylebox("pressed"));
        _sfxThemeOptionButton.AddThemeStyleboxOverride("focus", _langOptionButton.GetThemeStylebox("focus"));

        // Insert SFX theme options before LangLabel
        int langLabelIndex = _langLabel.GetIndex();
        vbox.AddChild(_sfxThemeLabel);
        vbox.MoveChild(_sfxThemeLabel, langLabelIndex);
        vbox.AddChild(_sfxThemeOptionButton);
        vbox.MoveChild(_sfxThemeOptionButton, langLabelIndex + 1);

        _sfxThemeOptionButton.ItemSelected += OnSfxThemeSelected;

        // Theme Panel references
        _themePanel = GetNode<PanelContainer>("ThemePanel");
        _forestButton = GetNode<Button>("ThemePanel/MarginContainer/VBoxContainer/GridContainer/ForestButton");
        _glacialButton = GetNode<Button>("ThemePanel/MarginContainer/VBoxContainer/GridContainer/GlacialButton");
        _cityButton = GetNode<Button>("ThemePanel/MarginContainer/VBoxContainer/GridContainer/CityButton");
        _caveButton = GetNode<Button>("ThemePanel/MarginContainer/VBoxContainer/GridContainer/CaveButton");
        _themeBackButton = GetNode<Button>("ThemePanel/MarginContainer/VBoxContainer/ThemeBackButton");

        // Level Panel references
        _level1Button = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/Level1Button");
        _level2Button = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/Level2Button");
        _level3Button = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/Level3Button");
        _level4Button = GetNode<Button>("LevelPanel/MarginContainer/VBoxContainer/Level4Button");
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
        _animatedButtons.Add(_forestButton);
        _animatedButtons.Add(_glacialButton);
        _animatedButtons.Add(_cityButton);
        _animatedButtons.Add(_caveButton);
        _animatedButtons.Add(_themeBackButton);
        _animatedButtons.Add(_level1Button);
        _animatedButtons.Add(_level2Button);
        _animatedButtons.Add(_level3Button);
        _animatedButtons.Add(_level4Button);
        _animatedButtons.Add(_levelBackButton);
        _animatedButtons.Add(_creditsBackButton);
        _animatedButtons.Add(_achievementsBackButton);
        _animatedButtons.Add(_sfxThemeOptionButton);

        foreach (var btn in _animatedButtons)
        {
            // Set pivot offset to center for scale zoom
            btn.PivotOffset = btn.CustomMinimumSize / 2.0f;
        }

        // Toggle initial panel visibility
        SetMainMenuVisible(true);
        _configPanel.Visible = false;
        _themePanel.Visible = false;
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

        // Theme Selection Press handlers
        _forestButton.Pressed += OnForestPressed;
        _glacialButton.Pressed += OnGlacialPressed;
        _cityButton.Pressed += OnCityPressed;
        _caveButton.Pressed += OnCavePressed;
        _themeBackButton.Pressed += OnThemeBackPressed;

        _level1Button.Pressed += OnLevel1Pressed;
        _level2Button.Pressed += OnLevel2Pressed;
        _level3Button.Pressed += OnLevel3Pressed;
        _level4Button.Pressed += OnLevel4Pressed;
        _levelBackButton.Pressed += OnLevelBackPressed;
        
        _creditsBackButton.Pressed += OnCreditsBackPressed;
        _achievementsBackButton.Pressed += OnAchievementsBackPressed;

        // Populate language dropdown
        PopulateLanguage();
        _langOptionButton.ItemSelected += OnLanguageSelected;

        // Populate joystick dropdown
        PopulateJoypads();

        // Connect Joypad connection events dynamically
        Input.Singleton.JoyConnectionChanged += OnJoyConnectionChanged;

        // Translate UI initially
        TranslateUI();

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
            btn.FocusEntered += () => PlayMenuSound("hover", 880f, 0.03f, 0.1f);
            
            // Hover automatically grabs focus for mouse navigation
            btn.MouseEntered += () => {
                if (!_isMappingInput && !btn.Disabled && btn.Visible)
                    btn.GrabFocus();
            };
        }
        else if (node is OptionButton optBtn)
        {
            optBtn.FocusEntered += () => PlayMenuSound("hover", 880f, 0.03f, 0.1f);
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

    private void PopulateLanguage()
    {
        _langOptionButton.Clear();
        _langOptionButton.AddItem("Português");
        _langOptionButton.SetItemMetadata(0, "pt");
        _langOptionButton.AddItem("English");
        _langOptionButton.SetItemMetadata(1, "en");

        if (GameSettings.Language == "en")
        {
            _langOptionButton.Select(1);
        }
        else
        {
            _langOptionButton.Select(0);
        }
    }

    private void PopulateSfxThemes()
    {
        _sfxThemeOptionButton.Clear();
        var themes = GameSettings.GetAvailableSoundThemes();
        bool isPt = GameSettings.Language == "pt";
        
        for (int i = 0; i < themes.Count; i++)
        {
            string theme = themes[i];
            string displayName = GameSettings.GetThemeDisplayName(theme, isPt);
            _sfxThemeOptionButton.AddItem(displayName);
            _sfxThemeOptionButton.SetItemMetadata(i, theme);
            
            if (theme == GameSettings.SoundTheme)
            {
                _sfxThemeOptionButton.Select(i);
            }
        }
    }

    private void OnSfxThemeSelected(long index)
    {
        string theme = (string)_sfxThemeOptionButton.GetItemMetadata((int)index);
        GameSettings.SoundTheme = theme;
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f);
    }

    private void OnLanguageSelected(long index)
    {
        string lang = (string)_langOptionButton.GetItemMetadata((int)index);
        GameSettings.Language = lang;
        TranslateUI();
        PlayMenuSound("forward", 587.33f, 0.1f, 0.3f); // D5 note sound
    }

    private void TranslateUI()
    {
        bool isPt = GameSettings.Language == "pt";
        
        // Main Menu Buttons
        _startButton.Text = isPt ? "JOGAR" : "PLAY";
        _configButton.Text = isPt ? "OPÇÕES" : "OPTIONS";
        _creditsButton.Text = isPt ? "CRÉDITOS" : "CREDITS";
        _exitButton.Text = isPt ? "SAIR" : "EXIT";
        
        // Config Menu
        GetNode<Label>("ConfigPanel/MarginContainer/VBoxContainer/Title").Text = isPt ? "CONFIGURAÇÕES" : "SETTINGS";
        GetNode<Label>("ConfigPanel/MarginContainer/VBoxContainer/JoyLabel").Text = isPt ? "Selecione o Joystick:" : "Select Controller:";
        GetNode<Label>("ConfigPanel/MarginContainer/VBoxContainer/MusicLabel").Text = isPt ? "Volume da Música:" : "Music Volume:";
        _langLabel.Text = isPt ? "Idioma:" : "Language:";
        _sfxThemeLabel.Text = isPt ? "Efeitos Sonoros:" : "Sound Effects:";
        _mapButton.Text = isPt ? "Mapear Pulo/Ação" : "Map Jump/Action";
        _backButton.Text = isPt ? "VOLTAR" : "BACK";

        PopulateSfxThemes();
        
        // Map Instructions
        if (_isMappingInput)
        {
            _mapInstructionsLabel.Text = isPt 
                ? "Aperte qualquer botão no seu controle..." 
                : "Press any button on your controller...";
        }

        // Corner / Back buttons
        _creditsBackButton.Text = isPt ? "VOLTAR" : "BACK";
        _achievementsBackButton.Text = isPt ? "VOLTAR" : "BACK";
        _themeBackButton.Text = isPt ? "VOLTAR" : "BACK";
        _levelBackButton.Text = isPt ? "VOLTAR" : "BACK";

        // Credits Panel
        GetNode<Label>("CreditsPanel/MarginContainer/VBoxContainer/Title").Text = isPt ? "CRÉDITOS" : "CREDITS";
        GetNode<Label>("CreditsPanel/MarginContainer/VBoxContainer/CreditsText").Text = isPt 
            ? "DESENVOLVIMENTO\nRicardo Borges\n\nDESIGN ARTÍSTICO\nPixel Art Engine\n\nMOTOR GRÁFICO\nGodot Engine 4.6 C#\n\nObrigado por jogar!"
            : "DEVELOPMENT\nRicardo Borges\n\nART DESIGN\nPixel Art Engine\n\nGAME ENGINE\nGodot Engine 4.6 C#\n\nThanks for playing!";

        // Achievements Panel
        GetNode<Label>("AchievementsPanel/MarginContainer/VBoxContainer/Title").Text = isPt ? "CONQUISTAS" : "ACHIEVEMENTS";
        GetNode<Label>("AchievementsPanel/MarginContainer/VBoxContainer/Ach1/AchTitle").Text = isPt ? "[x] Primeiros Passos" : "[x] First Steps";
        GetNode<Label>("AchievementsPanel/MarginContainer/VBoxContainer/Ach1/AchDesc").Text = isPt ? "Conclua a primeira fase de Paçoca." : "Complete the first level of Paçoca.";
        GetNode<Label>("AchievementsPanel/MarginContainer/VBoxContainer/Ach2/AchTitle").Text = isPt ? "[ ] Veloz e Furioso" : "[ ] Fast & Furious";
        GetNode<Label>("AchievementsPanel/MarginContainer/VBoxContainer/Ach2/AchDesc").Text = isPt ? "Alcance uma velocidade de 50 km/h." : "Reach a speed of 50 km/h.";
        GetNode<Label>("AchievementsPanel/MarginContainer/VBoxContainer/Ach3/AchTitle").Text = isPt ? "[x] Colecionador" : "[x] Collector";
        GetNode<Label>("AchievementsPanel/MarginContainer/VBoxContainer/Ach3/AchDesc").Text = isPt ? "Colete um total de 100 moedas." : "Collect a total of 100 rings.";

        // Theme Panel
        GetNode<Label>("ThemePanel/MarginContainer/VBoxContainer/Title").Text = isPt ? "SELECIONAR TEMA" : "SELECT THEME";
        _forestButton.GetNode<Label>("Label").Text = isPt ? "FLORESTA" : "FOREST";
        _glacialButton.GetNode<Label>("Label").Text = isPt ? "GLACIAL" : "GLACIAL";
        _cityButton.GetNode<Label>("Label").Text = isPt ? "CIDADE" : "CITY";
        _caveButton.GetNode<Label>("Label").Text = isPt ? "CAVERNA" : "CAVE";

        // Level Panel Dynamic Title & buttons
        string themeName = _selectedTheme switch
        {
            "glacial" => isPt ? "GLACIAL" : "GLACIAL",
            "city" => isPt ? "CIDADE" : "CITY",
            "cave" => isPt ? "CAVERNA" : "CAVE",
            _ => isPt ? "FLORESTA" : "FOREST"
        };
        GetNode<Label>("LevelPanel/MarginContainer/VBoxContainer/Title").Text = isPt 
            ? $"TEMA: {themeName}" 
            : $"THEME: {themeName}";

        _level1Button.Text = isPt ? "FASE 1" : "LEVEL 1";
        _level2Button.Text = isPt ? "FASE 2" : "LEVEL 2";
        _level3Button.Text = isPt ? "FASE 3" : "LEVEL 3";
        _level4Button.Text = isPt ? "FASE 4" : "LEVEL 4";
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
        PlayMenuSound("forward", 587.33f, 0.1f, 0.3f); // D5 note sound
    }

    private void OnStartPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f); // C5 note sound
        SetMainMenuVisible(false);
        _themePanel.Visible = true;
        _forestButton.GrabFocus();
    }

    private void OnForestPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f);
        _selectedTheme = "forest";
        _themePanel.Visible = false;
        _levelPanel.Visible = true;
        TranslateUI();
        _level1Button.GrabFocus();
    }

    private void OnGlacialPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f);
        _selectedTheme = "glacial";
        _themePanel.Visible = false;
        _levelPanel.Visible = true;
        TranslateUI();
        _level1Button.GrabFocus();
    }

    private void OnCityPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f);
        _selectedTheme = "city";
        _themePanel.Visible = false;
        _levelPanel.Visible = true;
        TranslateUI();
        _level1Button.GrabFocus();
    }

    private void OnCavePressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f);
        _selectedTheme = "cave";
        _themePanel.Visible = false;
        _levelPanel.Visible = true;
        TranslateUI();
        _level1Button.GrabFocus();
    }

    private void OnThemeBackPressed()
    {
        PlayMenuSound("backward", 392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _themePanel.Visible = false;
        _startButton.GrabFocus();
    }

    private string GetLevelPath(int levelNum)
    {
        switch (_selectedTheme)
        {
            case "glacial":
                return $"res://scenes/levels/level_glacial_{levelNum:00}.tscn";
            case "city":
                return $"res://scenes/levels/level_cidade_{levelNum:00}.tscn";
            case "cave":
                return $"res://scenes/levels/level_caverna_{levelNum:00}.tscn";
            case "forest":
            default:
                return $"res://scenes/levels/level_{levelNum:00}.tscn";
        }
    }

    private void OnLevel1Pressed()
    {
        PlayMenuSound("forward", 1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = GetLevelPath(1);
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnLevel2Pressed()
    {
        PlayMenuSound("forward", 1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = GetLevelPath(2);
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnLevel3Pressed()
    {
        PlayMenuSound("forward", 1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = GetLevelPath(3);
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnLevel4Pressed()
    {
        PlayMenuSound("forward", 1046.50f, 0.15f, 0.4f); // C6 note confirm sound
        GameSettings.LevelToLoad = GetLevelPath(4);
        ChangeSceneWithFade("res://scenes/main.tscn");
    }

    private void OnLevelBackPressed()
    {
        PlayMenuSound("backward", 392.00f, 0.1f, 0.3f); // G4 note back sound
        _themePanel.Visible = true;
        _levelPanel.Visible = false;
        
        switch (_selectedTheme)
        {
            case "glacial":
                _glacialButton.GrabFocus();
                break;
            case "city":
                _cityButton.GrabFocus();
                break;
            case "cave":
                _caveButton.GrabFocus();
                break;
            case "forest":
            default:
                _forestButton.GrabFocus();
                break;
        }
    }

    private void OnConfigPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f); // C5 note sound
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
        PlayMenuSound("backward", 392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _configPanel.Visible = false;
        _configButton.GrabFocus();
    }

    private void OnCreditsPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f); // C5 note sound
        SetMainMenuVisible(false);
        _creditsPanel.Visible = true;
        _creditsBackButton.GrabFocus();
    }

    private void OnCreditsBackPressed()
    {
        PlayMenuSound("backward", 392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _creditsPanel.Visible = false;
        _creditsButton.GrabFocus();
    }

    private void OnTrophyPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f); // C5 note sound
        SetMainMenuVisible(false);
        _achievementsPanel.Visible = true;
        _achievementsBackButton.GrabFocus();
    }

    private void OnAchievementsBackPressed()
    {
        PlayMenuSound("backward", 392.00f, 0.1f, 0.3f); // G4 note back sound
        SetMainMenuVisible(true);
        _achievementsPanel.Visible = false;
        _trophyButton.GrabFocus();
    }

    private void OnMapButtonPressed()
    {
        PlayMenuSound("forward", 523.25f, 0.1f, 0.3f); // C5 note sound
        _isMappingInput = true;
        
        TranslateUI();
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
            bool isPt = GameSettings.Language == "pt";
            _mapInstructionsLabel.Text = isPt 
                ? $"Botão {buttonId} configurado para Ação/Pulo!" 
                : $"Button {buttonId} bound to Action/Jump!";
            PlayMenuSound("forward", 880.0f, 0.25f, 0.4f); // High confirmation beep

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
        _langOptionButton.Disabled = disabled;
        _sfxThemeOptionButton.Disabled = disabled;
        _mapButton.Disabled = disabled;

        _forestButton.Disabled = disabled;
        _glacialButton.Disabled = disabled;
        _cityButton.Disabled = disabled;
        _caveButton.Disabled = disabled;
        _themeBackButton.Disabled = disabled;

        _level1Button.Disabled = disabled;
        _level2Button.Disabled = disabled;
        _level3Button.Disabled = disabled;
        _level4Button.Disabled = disabled;
        _levelBackButton.Disabled = disabled;
        
        _creditsBackButton.Disabled = disabled;
        _achievementsBackButton.Disabled = disabled;
    }

    private void OnExitPressed()
    {
        PlayMenuSound("backward", 261.63f, 0.2f, 0.3f); // C4 note quit sound
        GameSettings.FinalizeTelemetry();
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

    // Plays a menu sound based on the selected audio theme
    private void PlayMenuSound(string eventName, float fallbackFreq, float fallbackDuration, float fallbackVolume = 0.5f)
    {
        if (GameSettings.SoundTheme == "procedural" || string.IsNullOrEmpty(GameSettings.SoundTheme))
        {
            PlaySound(fallbackFreq, fallbackDuration, fallbackVolume);
        }
        else
        {
            string path = $"res://audio/effects/{GameSettings.SoundTheme}_{eventName.ToUpper()}.wav";
            var stream = GameSettings.LoadSFX(path);
            if (stream != null)
            {
                _sfxWavPlayer.Stream = stream;
                _sfxWavPlayer.Play();
            }
            else
            {
                PlaySound(fallbackFreq, fallbackDuration, fallbackVolume);
            }
        }
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
