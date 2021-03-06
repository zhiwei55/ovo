import * as _request from 'superagent';
import * as moment from 'moment';
const request = _request;

const zipkinUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:9411' : '';

export interface Endpoint {
  serviceName: string;
  ipv4?: string;
  port?: number;
}

export interface Annotation {
  timestamp: number;
  value: 'cs' | 'sr' | 'ss' | 'cr' | string;
  endpoint: Endpoint;
}

export interface BinaryAnnotation {
  key: string;
  value: string;
  endpoint: Endpoint;
}

export interface Span {
  traceId: string;
  id: string;
  parentId?: string;
  name: string;
  timestamp: number;
  duration: number;
  annotations: Annotation[];
  binaryAnnotations: any[];
}

export interface DependencyLink {
  callCount: number;
  child: string;
  parent: string;
}

export class SpanStats {
  public count: number = 0;
  public duration: number = 0;

  public accumulate(span: Span): this {
    this.count++;
    const sr = span.annotations.find(annotation => annotation.value === 'sr');
    const ss = span.annotations.find(annotation => annotation.value === 'ss');
    if (sr && ss && sr.timestamp && ss.timestamp) {
      this.duration += ss.timestamp - sr.timestamp;
    }
    return this;
  }
}

export class SpanNode {

  public readonly span: Span;
  public readonly children: SpanNode[];

  public readonly sr: number;
  public readonly ss: number;
  public readonly cr: number;
  public readonly cs: number;

  constructor(span: Span, children: SpanNode[]) {
    this.span = span;
    this.children = children;

    this.sr = this.getServerReceive();
    this.ss = this.getServerSend();
    this.cr = this.getClientReceive();
    this.cs = this.getClientSend();
  }

  public entries(): IterableIterator<[SpanNode, number]> {
    let nodeQueue = [ [this, 0] ] as Array<[SpanNode, number]>;
    return {
      next(): IteratorResult<[SpanNode, number]> {
        if (nodeQueue.length === 0) {
          return { done: true, value: undefined };
        }
        const [node, level] = nodeQueue.shift();
        for (let child of node.children) {
          nodeQueue.push([ child, level + 1 ]);
        }
        return { done: false, value: [ node, level ] };
      },

      [Symbol.iterator](): IterableIterator<[SpanNode, number]> {
        return this;
      },
    };
  }

  public [Symbol.iterator](): IterableIterator<[SpanNode, number]> {
    return this.entries();
  }

  public getServiceName(): string {
    // try to grab from endpoint annotation
    let maybeAnnotation = (this.span.annotations || [])
      .filter(annotation => annotation && annotation.endpoint && annotation.value)
      .filter(annotation => annotation.value === 'sr' || annotation.value === 'ss')
      .find(annotation => !!annotation.endpoint.serviceName);
    if (maybeAnnotation) {
      return maybeAnnotation.endpoint.serviceName;
    }

    // try to grab from endpoint binary annotation
    maybeAnnotation = (this.span.binaryAnnotations || [])
      .filter(annotation => annotation && annotation.endpoint && annotation.key)
      .filter(annotation => annotation.key === 'sa' || annotation.key === 'lc'
      || annotation.key === 'ca')
      .find(annotation => !!annotation.endpoint.serviceName);
    if (maybeAnnotation) {
      return maybeAnnotation.endpoint.serviceName;
    }

    // fall back to using the client annotation name
    maybeAnnotation = (this.span.annotations || [])
      .filter(annotation => annotation && annotation.endpoint && annotation.value)
      .filter(annotation => annotation.value === 'cs' || annotation.value === 'cr')
      .find(annotation => !!annotation.endpoint.serviceName);

    return maybeAnnotation ? maybeAnnotation.endpoint.serviceName : undefined;
  }

  public getSeviceSpanStats(spanNode = this as SpanNode,
                            serviceSpanStats = new Map<string, SpanStats>()):
                            Map<string, SpanStats> {
    const serviceName = spanNode.getServiceName();
    if (!serviceSpanStats.has(serviceName)) {
      serviceSpanStats.set(serviceName, new SpanStats());
    }
    serviceSpanStats.get(serviceName).accumulate(spanNode.span);

    for (let child of spanNode.children) {
      child.getSeviceSpanStats(child, serviceSpanStats);
    }
    return serviceSpanStats;
  }

  public addChild(spanNode: SpanNode): void {
    this.children.push(spanNode);
  }

  private getServerReceive(): number {
    // attempt to use the sr annotation, if available
    const sr = [...(this.span.annotations || []), ...(this.span.binaryAnnotations || [])]
      .find(annotation => annotation.value === 'sr' && !!annotation.timestamp);
    if (sr) {
      return sr.timestamp;
    }
    // else fall back to the span timestamp
    return undefined;
  }

  private getServerSend(): number {
    // attempt to use the ss annotation, if available
    const ss = [...(this.span.annotations || []), ...(this.span.binaryAnnotations || [])]
      .find(annotation => annotation.value === 'ss' && !!annotation.timestamp);
    if (ss) {
      return ss.timestamp;
    }
    return undefined;
  }

  private getClientReceive() {
    // attempt to use the cr annotation, if available
    const cr = [...(this.span.annotations || []), ...(this.span.binaryAnnotations || [])]
      .find(annotation => annotation.value === 'cr' && !!annotation.timestamp);
    if (cr) {
      return cr.timestamp;
    }
    return undefined;
  }

  private getClientSend() {
    // attempt to use the cs annotation, if available
    const cs = [...(this.span.annotations || []), ...(this.span.binaryAnnotations || [])]
      .find(annotation => annotation.value === 'cs' && !!annotation.timestamp);
    if (cs) {
      return cs.timestamp;
    }
    return undefined;
  }
}

/**
 * Converts a trace array to a trace tree.
 */
export const parseSpans = (spans: Span[]): SpanNode => {
  const spanMap = new Map<string, SpanNode>();
  for (let span of spans) {
    spanMap.set(span.id, new SpanNode(span, []));
  }

  let root = undefined;
  for (let span of spans) {
    const spanNode = spanMap.get(span.id);
    if (!span.parentId) {
      root = spanNode;
    } else if (spanMap.has(span.parentId)) {
      spanMap.get(span.parentId).addChild(spanNode);
    } else {
      // no parent id in the span, the data might not be there yet :(
    }
  }
  return root;
};

export const getTrace = async (traceId: string): Promise<any> => {
  const response = await request.get(`${zipkinUrl}/api/v1/trace/${traceId}`);
  const json = JSON.parse(response.text);
  return [ parseSpans(JSON.parse(response.text) as Span[]), json];
};

export const getServices = async (): Promise<string[]> => {
  const response = await request.get(`${zipkinUrl}/api/v1/services`);
  return JSON.parse(response.text);
};

export const getSpans = async(serviceName: string): Promise<string[]> => {
  const response = await request.get(`${zipkinUrl}/api/v1/spans`)
    .query({ serviceName });
  return JSON.parse(response.text);
};

export const getTraces = async (serviceName: string, start: number,
  end: number, limit: number, minDuration: number, spanName = 'all',
  annotationQuery?: string, ): Promise<SpanNode[]> => {
  const response = await request.get(`${zipkinUrl}/api/v1/traces`)
    .query({
      annotationQuery,
      endTs: end,
      limit: limit > 0 ? limit : 100,
      lookback: end - start,
      minDuration: minDuration > 0 ? minDuration : undefined,
      serviceName,
      spanName,
    });
  return (JSON.parse(response.text) as Span[][])
    .map(spans => parseSpans(spans))
    .filter(node => !!node);
};

export const getDependencies = async (endTs: number): Promise<DependencyLink[]> => {
  const response = await request.get(`${zipkinUrl}/api/v1/dependencies`)
    .query({ endTs });
  return JSON.parse(response.text) as DependencyLink[];
};