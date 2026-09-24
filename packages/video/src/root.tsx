import "./index.css";
import { Composition } from "remotion";

import {
  AGENT_READY_VIDEO_DURATION,
  AgentReadyVideo,
} from "./agent-ready-composition";
import { AUDIT_VIDEO_DURATION, AuditVideo } from "./audit-composition";
import { LaunchVideo } from "./composition";
import { EVAL_VIDEO_DURATION, EvalVideo } from "./eval-composition";
import {
  TRANSLATE_VIDEO_DURATION,
  TranslateVideo,
} from "./translate-composition";
import {
  V2_LAUNCH_VIDEO_DURATION,
  V2LaunchVideo,
} from "./v2-launch-composition";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LaunchVideo"
      component={LaunchVideo}
      durationInFrames={1371}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="AuditVideo"
      component={AuditVideo}
      durationInFrames={AUDIT_VIDEO_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="EvalVideo"
      component={EvalVideo}
      durationInFrames={EVAL_VIDEO_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="TranslateVideo"
      component={TranslateVideo}
      durationInFrames={TRANSLATE_VIDEO_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="AgentReadyVideo"
      component={AgentReadyVideo}
      durationInFrames={AGENT_READY_VIDEO_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="V2LaunchVideo"
      component={V2LaunchVideo}
      durationInFrames={V2_LAUNCH_VIDEO_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
