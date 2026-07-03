using Godot;

// Camera-following painted backdrop with horizontal UV parallax. Replaces the
// legacy static BG_Mountains quad at runtime (see Main.SetupParallaxBackground):
// the quad stays glued to the camera while the art pans at ScrollFactor of the
// camera's speed, so the horizon drifts like a distant landscape instead of a
// single image stretched across the whole level.
public partial class ParallaxBackground3D : MeshInstance3D
{
    // Fraction of the camera's horizontal motion applied to the art.
    // Small values read as "far away".
    [Export] public float ScrollFactor = 0.05f;

    // How much of the camera's vertical motion the backdrop follows. 1.0 would
    // pin the horizon to the screen; slightly less gives a subtle vertical
    // parallax when jumping or riding springs.
    [Export] public float VerticalFollow = 0.85f;

    // Level theme; resolves to res://materials/bg_<theme>.tres.
    [Export] public string LevelTheme = "forest";

    private const float PlaneZ = -48.0f;
    private const float QuadHeight = 110.0f;
    private const float HorizonLift = 14.0f;

    private Camera3D? _camera;
    private StandardMaterial3D? _material;
    private float _quadWidth = 1.0f;
    private float _baseCameraY;
    private float _baseY;

    public override void _Ready()
    {
        string path = $"res://materials/bg_{LevelTheme}.tres";
        if (!ResourceLoader.Exists(path))
        {
            path = "res://materials/bg_forest.tres";
        }
        // Local copy: uv1_offset animates every frame and must not leak into
        // the shared .tres (whose uv1_scale is tuned for legacy level quads).
        _material = (StandardMaterial3D)GD.Load<StandardMaterial3D>(path).Duplicate();
        _material.Uv1Scale = Vector3.One;

        // The art tiles seamlessly on X; size the quad so one copy of the
        // texture keeps its aspect ratio and horizontal panning wraps.
        var tex = _material.AlbedoTexture;
        float aspect = tex != null && tex.GetHeight() > 0
            ? tex.GetWidth() / (float)tex.GetHeight()
            : 3.6f;
        _quadWidth = QuadHeight * aspect;

        var quad = new QuadMesh();
        quad.Size = new Vector2(_quadWidth, QuadHeight);
        quad.Material = _material;
        Mesh = quad;
        CastShadow = GeometryInstance3D.ShadowCastingSetting.Off;

        _camera = GetViewport().GetCamera3D();
        if (_camera != null)
        {
            _baseCameraY = _camera.GlobalPosition.Y;
        }
        _baseY = _baseCameraY + HorizonLift;
        UpdateTransform();
    }

    public override void _Process(double delta)
    {
        UpdateTransform();
    }

    private void UpdateTransform()
    {
        if (_camera == null || _material == null) return;

        Vector3 cam = _camera.GlobalPosition;
        float y = _baseY + (cam.Y - _baseCameraY) * VerticalFollow;
        GlobalPosition = new Vector3(cam.X, y, PlaneZ);

        // Pan the art opposite to travel; wraps thanks to the seamless texture.
        var offset = _material.Uv1Offset;
        offset.X = cam.X * ScrollFactor / _quadWidth;
        _material.Uv1Offset = offset;
    }
}
