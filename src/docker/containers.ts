import { getDockerClient } from './client';
import { triggerAlert } from '../monitor/alerts';
import { logger } from '../utils/logger';

export interface ContainerData {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export const getRunningContainers = async (options?: { forceAlert?: boolean }): Promise<ContainerData[]> => {
  const docker = getDockerClient();
  try {
    // Try to list containers, use a timeout if possible or just catch common connection errors
    const containers = await docker.listContainers({ all: true });
    
    return containers.map((c) => {
      const name = c.Names[0]?.replace('/', '') || 'Unknown';
      const id = c.Id.substring(0, 12);

      // Check for failures (non-blocking alerts)
      if (c.State === 'restarting') {
        triggerAlert({
          id: `container:${name}:restarting`,
          type: 'container',
          severity: 'warning',
          message: `Docker container ${name} (${id}) is restarting.`,
        }, { force: options?.forceAlert });
      } else if (c.State === 'exited') {
        const match = c.Status.match(/Exited \((\d+)\)/);
        const exitCode = match ? parseInt(match[1], 10) : 0;
        
        if (exitCode !== 0) {
          triggerAlert({
            id: `container:${name}:failure`,
            type: 'container',
            severity: 'critical',
            message: `Docker container ${name} (${id}) exited with code ${exitCode}.`,
          }, { force: options?.forceAlert });
        }
      }

      return {
        id,
        name,
        image: c.Image,
        state: c.State,
        status: c.Status,
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch Docker containers: ${errorMessage}`);
    // Throw error so UI can handle it instead of showing empty list
    throw error;
  }
};

export interface DockerSystemStats {
  cpu: number;
  memoryUsage: number;
  memoryLimit: number;
}

export const formatDockerBytes = (bytes: number): string => {
  if (bytes <= 0) return '0B';
  const decimalK = 1000;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(decimalK)), sizes.length - 1);
  const num = bytes / Math.pow(decimalK, i);
  return `${parseFloat(num.toFixed(1))}${sizes[i]}`;
};

export const getDockerSystemStats = async (): Promise<DockerSystemStats | null> => {
  const docker = getDockerClient();
  try {
    const containers = await docker.listContainers({ filters: { status: ['running'] } });
    if (containers.length === 0) {
      let limit = 0;
      try {
        const info = await docker.info();
        limit = info.MemTotal || 0;
      } catch {}
      return { cpu: 0, memoryUsage: 0, memoryLimit: limit };
    }

    let totalCpu = 0;
    let totalMemory = 0;
    let maxLimit = 0;

    const statsPromises = containers.map(async (c) => {
      try {
        const container = docker.getContainer(c.Id);
        const stats = await container.stats({ stream: false });
        
        // Calculate CPU usage percentage
        const cpuStats = stats.cpu_stats;
        const precpuStats = stats.precpu_stats;
        let cpuPercent = 0;
        
        if (cpuStats && precpuStats && cpuStats.cpu_usage && precpuStats.cpu_usage) {
          const cpuDelta = (cpuStats.cpu_usage.total_usage || 0) - (precpuStats.cpu_usage.total_usage || 0);
          const systemCpuDelta = (cpuStats.system_cpu_usage || 0) - (precpuStats.system_cpu_usage || 0);
          const onlineCpus = cpuStats.online_cpus || cpuStats.cpu_usage.percpu_usage?.length || 1;
          
          if (systemCpuDelta > 0 && cpuDelta > 0) {
            cpuPercent = (cpuDelta / systemCpuDelta) * onlineCpus * 100;
          }
        }

        // Calculate Memory usage
        let memoryUsage = 0;
        let limit = 0;
        if (stats.memory_stats) {
          memoryUsage = stats.memory_stats.usage || 0;
          const cache = stats.memory_stats.stats?.cache || stats.memory_stats.stats?.inactive_file || 0;
          if (memoryUsage > cache) {
            memoryUsage -= cache;
          }
          limit = stats.memory_stats.limit || 0;
        }

        return { cpuPercent, memoryUsage, limit };
      } catch (err) {
        return { cpuPercent: 0, memoryUsage: 0, limit: 0 };
      }
    });

    const results = await Promise.all(statsPromises);
    for (const res of results) {
      totalCpu += res.cpuPercent;
      totalMemory += res.memoryUsage;
      if (res.limit > maxLimit) {
        maxLimit = res.limit;
      }
    }

    if (maxLimit === 0) {
      try {
        const info = await docker.info();
        maxLimit = info.MemTotal || 0;
      } catch {}
    }

    return {
      cpu: totalCpu,
      memoryUsage: totalMemory,
      memoryLimit: maxLimit,
    };
  } catch (error) {
    return null;
  }
};

