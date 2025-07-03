import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-leveler',
  template: `
    <button (click)="calibrate()">Calibrate</button>
    <canvas #levelCanvas style="aspect-ratio:1; width: 100%;"></canvas>
    <div class="leveler-info">
      <h3>γ (X-axis): {{ gamma.toFixed(1) }}°</h3>
      <h3>β (Y-axis): {{ beta.toFixed(1) }}°</h3>
    </div>
  `,
  styleUrl: './leveler.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelerComponent implements OnInit, AfterViewInit {
  readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('levelCanvas');
  private ctx!: CanvasRenderingContext2D;
  beta = 0;
  gamma = 0;
  private betaOffset = 0;
  private gammaOffset = 0;

  private readonly levelToleranceDegrees = 2;
  private readonly referenceCanvasSize = 300;

  private readonly MAX_TILT_ANGLE_DEGREES = 90;
  private readonly CIRCLE_BORDER_PADDING = 10;
  private readonly CENTER_LINE_THICKNESS_FACTOR = 0.5;

  private readonly levelerConfigs = [
    {
      type: 'circle',
      refX: 10,
      refY: 10,
      refSize: 220,
      refBubbleRadius: 15, // Keep as is, or slightly larger like 18
      refZeroCirclePadding: 3,
      refBullseyeRadius: 2,
      associatedAxis: 'both',
      trackColor: '#424242', // Added for consistent background
      lineColor: '#B0BEC5', // Changed to match bar levelers
      centerLineColor: '#CFD8DC', // Changed to match bar levelers
      bubbleColorLevel: '#8BC34A', // Slightly brighter green for level
      bubbleColorNotLevel: '#EF5350', // Brighter red for not level
      // zeroMarkColor removed, using lineColor instead
      zeroLineThickness: 2.5, // Slightly thicker for emphasis
      normalLineThickness: 2, // Thicker main lines
      bubbleLineThickness: 1.5, // Slightly thicker bubble border
    },
    {
      type: 'verticalBar',
      refX: 250,
      refY: 10,
      refWidth: 30,
      refHeight: 220,
      refBubbleRadius: 10,
      refZeroLinePadding: 2,
      refLineShorten: 8,
      associatedAxis: 'beta',
      trackColor: '#424242', // Dark Grey for the track
      lineColor: '#B0BEC5', // Muted blue-grey for the bar frame
      centerLineColor: '#CFD8DC', // Lighter blue-grey for center line
      bubbleColorLevel: '#8BC34A', // Same brighter green
      bubbleColorNotLevel: '#EF5350', // Same brighter red
      // zeroMarkColor removed, using lineColor instead
      zeroLineThickness: 2,
      normalLineThickness: 1.5, // Slightly thicker bar frame
      bubbleLineThickness: 1.5, // Slightly thicker bubble border
    },
    {
      type: 'horizontalBar',
      refX: 10,
      refY: 250,
      refWidth: 220,
      refHeight: 30,
      refBubbleRadius: 10,
      refZeroLinePadding: 2,
      refLineShorten: 8,
      associatedAxis: 'gamma',
      trackColor: '#424242', // Dark Grey for the track
      lineColor: '#B0BEC5', // Muted blue-grey for the bar frame
      centerLineColor: '#CFD8DC', // Lighter blue-grey for center line
      bubbleColorLevel: '#8BC34A', // Same brighter green
      bubbleColorNotLevel: '#EF5350', // Same brighter red
      // zeroMarkColor removed, using lineColor instead
      zeroLineThickness: 2,
      normalLineThickness: 1.5, // Slightly thicker bar frame
      bubbleLineThickness: 1.5, // Slightly thicker bubble border
    },
  ];

  ngOnInit() {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      (DeviceOrientationEvent as any)
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            console.log('Device orientation permission granted');
          }
        })
        .catch(console.error);
    }
  }

  ngAfterViewInit() {
    this.ctx = this.canvasRef().nativeElement.getContext('2d')!;
    this.setCanvasDimensions();
    this.drawLeveler(0, 0);
  }

  @HostListener('window:resize')
  onResize() {
    this.setCanvasDimensions();
    this.drawLeveler(this.gamma, this.beta);
  }

  private setCanvasDimensions() {
    const canvas = this.canvasRef().nativeElement;
    const displayWidth = canvas.offsetWidth;
    canvas.width = displayWidth;
    canvas.height = displayWidth;
  }

  @HostListener('window:deviceorientation', ['$event'])
  onDeviceOrientation(event: DeviceOrientationEvent) {
    this.beta = (event.beta || 0) - this.betaOffset;
    this.gamma = (event.gamma || 0) - this.gammaOffset;
    this.drawLeveler(this.gamma, this.beta);
  }

  calibrate() {
    this.betaOffset = this.beta;
    this.gammaOffset = this.gamma;
    this.drawLeveler(0, 0);
  }

  private drawLeveler(gamma: number, beta: number) {
    const canvas = this.canvasRef().nativeElement;
    const ctx = this.ctx;
    const currentWidth = canvas.width;

    const scaleFactor = currentWidth / this.referenceCanvasSize;

    ctx.clearRect(0, 0, currentWidth, currentWidth);
    ctx.fillStyle = '#212121'; // Dark background for the canvas
    ctx.fillRect(0, 0, currentWidth, currentWidth);

    ctx.save();
    ctx.scale(scaleFactor, scaleFactor);

    for (const config of this.levelerConfigs) {
      let isLevelForThisLeveler = false;
      if (config.associatedAxis === 'both') {
        isLevelForThisLeveler =
          Math.abs(beta) < this.levelToleranceDegrees &&
          Math.abs(gamma) < this.levelToleranceDegrees;
      } else if (config.associatedAxis === 'beta') {
        isLevelForThisLeveler = Math.abs(beta) < this.levelToleranceDegrees;
      } else if (config.associatedAxis === 'gamma') {
        isLevelForThisLeveler = Math.abs(gamma) < this.levelToleranceDegrees;
      }

      if (config.type === 'circle') {
        this._drawCircleLeveler(
          ctx,
          config,
          gamma,
          beta,
          isLevelForThisLeveler
        );
      } else if (config.type === 'verticalBar') {
        this._drawVerticalBarLeveler(ctx, config, beta, isLevelForThisLeveler);
      } else if (config.type === 'horizontalBar') {
        this._drawHorizontalBarLeveler(
          ctx,
          config,
          gamma,
          isLevelForThisLeveler
        );
      }
    }

    ctx.restore();
  }
  private _drawCircleLeveler(
    ctx: CanvasRenderingContext2D,
    config: any,
    gamma: number,
    beta: number,
    isLevelForThisLeveler: boolean
  ) {
    const x = config.refX;
    const y = config.refY;
    const width = config.refSize;
    const height = config.refSize;
    const bubbleRadius = config.refBubbleRadius;

    const mainCenterX = x + width / 2;
    const mainCenterY = y + height / 2;
    const mainRadius = config.refSize / 2 - this.CIRCLE_BORDER_PADDING;

    // Draw the background circle (track)
    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, config.refSize / 2, 0, 2 * Math.PI); // Fill the entire designated area for the circle
    ctx.fillStyle = config.trackColor;
    ctx.fill();

    // Draw main circle frame
    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, mainRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.normalLineThickness;
    ctx.stroke();

    // Draw center lines (crosshairs)
    ctx.beginPath();
    ctx.strokeStyle = config.centerLineColor;
    ctx.lineWidth =
      config.normalLineThickness * this.CENTER_LINE_THICKNESS_FACTOR;
    ctx.moveTo(mainCenterX, mainCenterY - mainRadius);
    ctx.lineTo(mainCenterX, mainCenterY + mainRadius);
    ctx.moveTo(mainCenterX - mainRadius, mainCenterY);
    ctx.lineTo(mainCenterX + mainRadius, mainCenterY);
    ctx.stroke();

    // Draw zero area circle
    const levelTolerancePixelRadius =
      (this.levelToleranceDegrees / this.MAX_TILT_ANGLE_DEGREES) * mainRadius;
    const zeroAreaCircleRadius =
      levelTolerancePixelRadius + bubbleRadius + config.refZeroCirclePadding;
    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, zeroAreaCircleRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = config.lineColor; // Now using lineColor for zero mark
    ctx.lineWidth = config.zeroLineThickness;
    ctx.stroke();

    // Draw bullseye
    const bullseyeRadius = config.refBullseyeRadius;
    ctx.beginPath();
    ctx.arc(mainCenterX, mainCenterY, bullseyeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = config.centerLineColor;
    ctx.fill();

    // Calculate bubble position
    // NEGATE gamma and beta for a bubble level (bubble moves to the higher side)
    const bubbleMainX =
      mainCenterX - (gamma / this.MAX_TILT_ANGLE_DEGREES) * mainRadius;
    const bubbleMainY =
      mainCenterY - (beta / this.MAX_TILT_ANGLE_DEGREES) * mainRadius;

    const distFromCenter = Math.sqrt(
      (bubbleMainX - mainCenterX) ** 2 + (bubbleMainY - mainCenterY) ** 2
    );
    let finalBubbleMainX = bubbleMainX;
    let finalBubbleMainY = bubbleMainY;
    if (distFromCenter > mainRadius - bubbleRadius) {
      const angle = Math.atan2(
        bubbleMainY - mainCenterY,
        bubbleMainX - mainCenterX
      );
      finalBubbleMainX =
        mainCenterX + (mainRadius - bubbleRadius) * Math.cos(angle);
      finalBubbleMainY =
        mainCenterY + (mainRadius - bubbleRadius) * Math.sin(angle);
    }

    // Draw bubble
    ctx.beginPath();
    ctx.arc(finalBubbleMainX, finalBubbleMainY, bubbleRadius, 0, 2 * Math.PI);

    // Apply a radial gradient for a more realistic liquid/glass effect
    const gradient = ctx.createRadialGradient(
      finalBubbleMainX - bubbleRadius * 0.3, // Offset x for light source
      finalBubbleMainY - bubbleRadius * 0.3, // Offset y for light source
      bubbleRadius * 0.1, // Start radius for inner highlight
      finalBubbleMainX, // End x
      finalBubbleMainY, // End y
      bubbleRadius // End radius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)'); // Highlight
    gradient.addColorStop(
      0.5,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );
    gradient.addColorStop(
      1,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.bubbleLineThickness;
    ctx.stroke();
  }

  private _drawVerticalBarLeveler(
    ctx: CanvasRenderingContext2D,
    config: any,
    beta: number,
    isLevelForThisLeveler: boolean
  ) {
    const x = config.refX;
    const y = config.refY;
    const width = config.refWidth;
    const height = config.refHeight;
    const bubbleRadius = config.refBubbleRadius;

    // Draw frame (track)
    ctx.fillStyle = config.trackColor;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.normalLineThickness;
    ctx.strokeRect(x, y, width, height);

    // Draw center line
    ctx.beginPath();
    ctx.strokeStyle = config.centerLineColor;
    ctx.lineWidth =
      config.normalLineThickness * this.CENTER_LINE_THICKNESS_FACTOR;
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x + width / 2, y + height);
    ctx.stroke();

    // Draw zero lines
    const zeroLineGap = bubbleRadius + config.refZeroLinePadding;
    const lineLength = width - config.refLineShorten;
    const lineXStart = x + (width - lineLength) / 2;

    // Now using lineColor for zero mark
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.zeroLineThickness;

    ctx.beginPath();
    ctx.moveTo(lineXStart, y + height / 2 - zeroLineGap);
    ctx.lineTo(lineXStart + lineLength, y + height / 2 - zeroLineGap);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(lineXStart, y + height / 2 + zeroLineGap);
    ctx.lineTo(lineXStart + lineLength, y + height / 2 + zeroLineGap);
    ctx.stroke();

    // Calculate bubble position
    const bubbleVertY =
      y +
      height / 2 -
      (beta / this.MAX_TILT_ANGLE_DEGREES) * (height / 2 - bubbleRadius);
    const finalBubbleVertY = Math.min(
      Math.max(bubbleVertY, y + bubbleRadius),
      y + height - bubbleRadius
    );

    // Draw bubble
    ctx.beginPath();
    ctx.arc(x + width / 2, finalBubbleVertY, bubbleRadius, 0, 2 * Math.PI);

    // Apply a radial gradient for a more realistic liquid/glass effect
    const gradient = ctx.createRadialGradient(
      x + width / 2 - bubbleRadius * 0.3,
      finalBubbleVertY - bubbleRadius * 0.3,
      bubbleRadius * 0.1,
      x + width / 2,
      finalBubbleVertY,
      bubbleRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)'); // Highlight
    gradient.addColorStop(
      0.5,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );
    gradient.addColorStop(
      1,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.bubbleLineThickness;
    ctx.stroke();
  }
  private _drawHorizontalBarLeveler(
    ctx: CanvasRenderingContext2D,
    config: any,
    gamma: number,
    isLevelForThisLeveler: boolean
  ) {
    const x = config.refX;
    const y = config.refY;
    const width = config.refWidth;
    const height = config.refHeight;
    const bubbleRadius = config.refBubbleRadius;

    // Draw frame (track)
    ctx.fillStyle = config.trackColor;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.normalLineThickness;
    ctx.strokeRect(x, y, width, height);

    // Draw center line
    ctx.beginPath();
    ctx.strokeStyle = config.centerLineColor;
    ctx.lineWidth =
      config.normalLineThickness * this.CENTER_LINE_THICKNESS_FACTOR;
    ctx.moveTo(x, y + height / 2);
    ctx.lineTo(x + width, y + height / 2);
    ctx.stroke();

    // Draw zero lines
    const zeroLineGapHorz = bubbleRadius + config.refZeroLinePadding;
    const lineHeight = height - config.refLineShorten;
    const lineYStart = y + (height - lineHeight) / 2;

    // Now using lineColor for zero mark
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.zeroLineThickness;

    ctx.beginPath();
    ctx.moveTo(x + width / 2 - zeroLineGapHorz, lineYStart);
    ctx.lineTo(x + width / 2 - zeroLineGapHorz, lineYStart + lineHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + width / 2 + zeroLineGapHorz, lineYStart);
    ctx.lineTo(x + width / 2 + zeroLineGapHorz, lineYStart + lineHeight);
    ctx.stroke();

    // Calculate bubble position
    // NEGATE gamma for a bubble level (bubble moves to the higher side)
    const bubbleHorzX =
      x +
      width / 2 - // Changed from + to -
      (gamma / this.MAX_TILT_ANGLE_DEGREES) * (width / 2 - bubbleRadius);
    const finalBubbleHorzX = Math.min(
      Math.max(bubbleHorzX, x + bubbleRadius),
      x + width - bubbleRadius
    );

    // Draw bubble
    ctx.beginPath();
    ctx.arc(finalBubbleHorzX, y + height / 2, bubbleRadius, 0, 2 * Math.PI);

    // Apply a radial gradient for a more realistic liquid/glass effect
    const gradient = ctx.createRadialGradient(
      finalBubbleHorzX - bubbleRadius * 0.3,
      y + height / 2 - bubbleRadius * 0.3,
      bubbleRadius * 0.1,
      finalBubbleHorzX,
      y + height / 2,
      bubbleRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)'); // Highlight
    gradient.addColorStop(
      0.5,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );
    gradient.addColorStop(
      1,
      isLevelForThisLeveler
        ? config.bubbleColorLevel
        : config.bubbleColorNotLevel
    );

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.bubbleLineThickness;
    ctx.stroke();
  }
}
