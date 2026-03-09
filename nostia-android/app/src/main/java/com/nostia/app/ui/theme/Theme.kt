package com.nostia.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val NostiaDarkColorScheme = darkColorScheme(
    primary = NostiaPrimary,
    onPrimary = NostiaOnPrimary,
    background = NostiaBackground,
    onBackground = NostiaTextPrimary,
    surface = NostiaSurface,
    onSurface = NostiaTextPrimary,
    surfaceVariant = NostiaSurface,
    onSurfaceVariant = NostiaTextSecondary,
    outline = NostiaBorder,
    error = NostiaError,
    secondary = NostiaTextSecondary,
    onSecondary = NostiaTextPrimary
)

@Composable
fun NostiaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = NostiaDarkColorScheme,
        content = content
    )
}
