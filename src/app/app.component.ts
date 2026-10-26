import { Component, HostListener, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VideoProcessor } from '@pexip/media-processor';
import { getVideoProcessor, VideoEffectTransformer } from './video-processor';
type SelectEffectType = {
    id: 0 | 1 | 2;
    name: 'none' | 'blur' | 'overlay';
};

interface Effect {
  value: string;
  viewValue: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  effects: Effect[] = [
    {value: 'none', viewValue: 'None'},
    {value: 'blur', viewValue: 'Blur background'},
    {value: 'overlay', viewValue: 'Background replacement'},
  ];

  @ViewChild('localVideoElement') localVideoElement!: ElementRef<HTMLVideoElement>;

  title = 'media-processor-example';
  effect: string = this.effects[0].value;
  selectedEffect: SelectEffectType = { name: 'none', id: 0 };
  private localStream: MediaStream | null = null;
  processedStream: MediaStream | null = null;
  // One processor for the component's lifetime; effects are switched on its transformer
  private videoProcessor: VideoProcessor | null = null;
  private transformer: VideoEffectTransformer | null = null;

  @HostListener('window:beforeunload', ['$event'])
  @HostListener('window:pagehide', ['$event'])
  handleWindowClose($event: BeforeUnloadEvent | PageTransitionEvent): void {
    if($event.type === 'beforeunload') {
      console.log('beforeunload event detected, closing streams and processors');
      this.closeAll();
      return;
    }
    if($event.type === 'pagehide' && !('persisted' in $event)) {
      console.log('pagehide event detected, persisted not in event, closing streams and processors');
      this.closeAll();
      return;
    }
    if($event.type === 'pagehide' && ('persisted' in $event && !$event.persisted)) {
      console.log('pagehide event detected, page not persisted, closing streams and processors');
      this.closeAll();
      return;
    }
    return;
  }

  private stopStream(stream: MediaStream | null): void {
    if (!stream) {
      return;
    }

    try {
      stream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {
          console.warn('Error stopping track', t);
        }
      });
    } catch {
      console.warn('Error stopping stream', stream);
    }
  }

  private closeAll(): void {
    this.stopStream(this.localStream);
    this.stopStream(this.processedStream);
    // Fire-and-forget: closeAll runs from sync unload handlers
    void this.destroyProcessor();
    this.processedStream = this.localStream = null;
    this.effect = this.effects[0].value;
  }

  // close() leaves the segmenter's Worker alive, so destroy() (which closes
  // first, then terminates the worker) is the only full teardown
  private async destroyProcessor(): Promise<void> {
    const processor = this.videoProcessor;
    this.videoProcessor = this.transformer = null;
    if (!processor) {
      return;
    }
    try {
      await processor.destroy();
    } catch {
      console.warn('Error destroying processor', processor);
    }
  }

  handleChangeEffect(e: Event): void {
    const name = (e.target as HTMLSelectElement).value as SelectEffectType['name'];
    if (name === this.selectedEffect.name) {
      return;
    }
    this.effect = name;
    this.selectedEffect = { name, id: name === 'none' ? 0 : name === 'blur' ? 1 : 2 };
    // Takes effect on the next frame; the segmenter worker opens lazily on the first blur/overlay frame
    if (this.transformer) {
      this.transformer.effects = name;
    }
  }

  private async startProcessing(effect: SelectEffectType): Promise<void> {
    if (!this.localStream) {
      return;
    }
    try {
      const { processor, transformer } = await getVideoProcessor(effect.name);
      this.videoProcessor = processor;
      this.transformer = transformer;
      // Pick up any change made while the processor was being created
      transformer.effects = this.selectedEffect.name;
      this.processedStream = await processor.process(this.localStream);
    } catch (err) {
      console.error('Error starting video processing:', err);
      this.processedStream = this.localStream;
    }
  }

  get playbackVideo(): HTMLVideoElement | null {
    return this.localVideoElement?.nativeElement ? this.localVideoElement.nativeElement : null;
  }

  async initialize(): Promise<void | "loaded"> {
    if (!this.playbackVideo) {
      return;
    }
    this.playbackVideo.src = '';
    this.playbackVideo.controls = false;
    try {
      this.playbackVideo.load();
    } catch (err) {
      console.warn(err);
    }
    this.playbackVideo.onloadeddata = async (_event) => {
      try {
        await this.playbackVideo?.play();
      } catch (err) {
        console.warn(err);
      }
    }
    return "loaded";
  }
  async callGetUserMedia(): Promise<void> {
    try {
      if(!this.playbackVideo) {
        return;
      }
      const srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
      if (srcObject) {
        this.localStream = this.processedStream = srcObject;
        this.playbackVideo.controls = false;
        this.playbackVideo.muted = true;
      } else {
        this.playbackVideo.srcObject = null;
        this.processedStream = null;
        this.localStream = null;
      }
      return;
    } catch (error) {
      console.error('mediaDevice.getUserMedia() error:', error);
      return;
    }
  }

  async ngAfterViewInit(): Promise<void> {
    const ready: void | "loaded" = await this.initialize();
    if (ready !== "loaded") {
      return;
    }
    await this.callGetUserMedia();
    await this.startProcessing(this.selectedEffect);
    return;
  }

  ngOnDestroy() {
    this.closeAll();
  }
}
