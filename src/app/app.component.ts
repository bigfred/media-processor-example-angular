import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VideoProcessor } from '@pexip/media-processor';
import { getVideoProcessor } from './video-processor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'media-processor-example';
  processedStream: MediaStream | null = null;
  effect = 'none';
  effects = ['none', 'blur', 'overlay'];

  private localStream: MediaStream | null = null;
  private currentVideoProcessor: VideoProcessor | null = null;

  handleChangeEffect = async (event: any): Promise<void> => {
    console.log('Changing effect', event.target.value);
    this.currentVideoProcessor?.close();

    if(this.localStream !== null) {
      this.currentVideoProcessor = await getVideoProcessor(event.target.value);
      this.processedStream = await this.currentVideoProcessor.process(this.localStream);
    }
  }

  ngOnInit() {
    navigator.mediaDevices
      .getUserMedia({
        video: true
      })
      .then((stream) => {
        this.localStream = stream;
        this.processedStream = stream;
      })
      .catch((error) => {
        console.error('mediaDevice.getUserMedia() error:', error);
        return;
      });
  }

  ngOnDestroy() {
    if(this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
  }
}
