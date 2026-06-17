using Godot;
using System;

[Tool]
public partial class SlantedPanel : PanelContainer
{
    [Export] public Color BgColor { get; set; } = new Color(0.04f, 0.06f, 0.10f, 0.7f);
    [Export] public Color BorderColor { get; set; } = new Color(0.0f, 0.83f, 1.0f, 0.9f);
    [Export] public float BorderWidth { get; set; } = 2.5f;
    [Export] public float SkewAmount { get; set; } = 15.0f;
    
    [Export] public bool DrawTopBorderOnly { get; set; } = false;
    [Export] public bool DrawBottomBorderOnly { get; set; } = false;

    public override void _Ready()
    {
        Resized += QueueRedraw;
        // Apply an empty stylebox to override the default panel theme stylebox
        AddThemeStyleboxOverride("panel", new StyleBoxEmpty());
    }

    public override void _Draw()
    {
        Vector2 size = Size;
        if (size.X <= 0 || size.Y <= 0) return;

        // Points for the parallelogram (slanted to the right at the top like / /)
        // Top-left: (SkewAmount, 0)
        // Top-right: (width, 0)
        // Bottom-right: (width - SkewAmount, height)
        // Bottom-left: (0, height)
        Vector2[] points = new Vector2[]
        {
            new Vector2(SkewAmount, 0),
            new Vector2(size.X, 0),
            new Vector2(size.X - SkewAmount, size.Y),
            new Vector2(0, size.Y)
        };

        // Draw shadow (shifted down and right)
        Vector2 shadowOffset = new Vector2(4.0f, 4.0f);
        Vector2[] shadowPoints = new Vector2[]
        {
            points[0] + shadowOffset,
            points[1] + shadowOffset,
            points[2] + shadowOffset,
            points[3] + shadowOffset
        };
        DrawPolygon(shadowPoints, new Color[] { new Color(0, 0, 0, 0.35f) });

        // Draw fill background
        DrawPolygon(points, new Color[] { BgColor });

        // Draw borders
        if (DrawTopBorderOnly)
        {
            DrawLine(points[0], points[1], BorderColor, BorderWidth, true);
        }
        else if (DrawBottomBorderOnly)
        {
            DrawLine(points[3], points[2], BorderColor, BorderWidth, true);
        }
        else
        {
            // Full outline loop
            Vector2[] outline = new Vector2[]
            {
                points[0], points[1], points[2], points[3], points[0]
            };

            // Glow effect: Draw thicker, semi-transparent line first
            Color glowColor = new Color(BorderColor.R, BorderColor.G, BorderColor.B, 0.25f);
            DrawPolyline(outline, glowColor, BorderWidth + 4.0f, true);

            // Core border line
            DrawPolyline(outline, BorderColor, BorderWidth, true);
        }
    }
}
