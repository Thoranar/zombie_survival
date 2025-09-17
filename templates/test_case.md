# AI Test Case Template

## Purpose
<What function or system is being tested?>

## Given
<Initial conditions, config values, or setup>

## When
<Action performed>

## Then
<Expected result>

```ts
// Example Vitest structure
import { describe, it, expect } from "vitest";

describe("<system>", () => {
  it("should <do something>", () => {
    // Arrange
    // Act
    // Assert
  });
});
```
