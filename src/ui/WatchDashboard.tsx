import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { getRunningPods, PodData, getK8sClusterStats, K8sClusterStats } from '../kubernetes/pods';
import { getRunningContainers, ContainerData, getDockerSystemStats, DockerSystemStats, formatDockerBytes } from '../docker/containers';

const StatusBadge = ({ status, type }: { status: string, type: 'pod' | 'container' }) => {
  const isRunning = type === 'pod' ? status === 'Running' : status === 'running';
  const bgColor = isRunning ? 'green' : (status === 'Pending' || status === 'restarting' ? 'yellow' : 'red');
  const textColor = isRunning || bgColor === 'yellow' ? 'black' : 'white';

  return (
    <Box paddingX={1}>
      <Text color={textColor} bold backgroundColor={bgColor}>
        {status.toUpperCase()}
      </Text>
    </Box>
  );
};

export const WatchDashboard = () => {
  const [pods, setPods] = useState<PodData[]>([]);
  const [containers, setContainers] = useState<ContainerData[]>([]);
  const [k8sStats, setK8sStats] = useState<K8sClusterStats | null>(null);
  const [dockerStats, setDockerStats] = useState<DockerSystemStats | null>(null);
  const [error, setError] = useState<{ type: string; message: string } | null>(null);

  useEffect(() => {
    const fetchPods = async () => {
      try {
        const p = await getRunningPods();
        setPods(p);
        setError(prev => prev?.type === 'k8s' ? null : prev);
      } catch (err) {
        setError({ type: 'k8s', message: (err as Error).message });
      }
    };

    const fetchContainers = async () => {
      try {
        const c = await getRunningContainers();
        setContainers(c);
        setError(prev => prev?.type === 'docker' ? null : prev);
      } catch (err) {
        setError({ type: 'docker', message: (err as Error).message });
      }
    };

    const fetchK8sStats = async () => {
      try {
        const stats = await getK8sClusterStats();
        setK8sStats(stats);
      } catch (err) {
        setK8sStats(null);
      }
    };

    const fetchDockerStats = async () => {
      try {
        const stats = await getDockerSystemStats();
        setDockerStats(stats);
      } catch (err) {
        setDockerStats(null);
      }
    };

    const fetchData = () => {
      fetchPods();
      fetchContainers();
      fetchK8sStats();
      fetchDockerStats();
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color="cyan" bold> 󱔎 KDM Live Dashboard </Text>
        </Box>
        <Box>
          <Text dimColor>(Press Ctrl+C to exit)</Text>
        </Box>
      </Box>

      {error && (
        <Box marginBottom={1} paddingX={1}>
          <Text color="white" bold backgroundColor="red"> ERROR: {error.type.toUpperCase()} - {error.message} </Text>
        </Box>
      )}
      
      <Box flexDirection="row">
        <Box flexDirection="column" width="50%" paddingRight={2}>
          <Box borderStyle="single" borderColor="blue" paddingX={1} marginBottom={1}>
            <Text color="blue" bold>Kubernetes Pods ({pods.length})</Text>
          </Box>
          <Box marginBottom={1} paddingX={1}>
            <Text dimColor>
              {k8sStats 
                ? `${k8sStats.source === 'requests' ? 'k8s Requests' : 'k8s Stats'}: CPU: ${k8sStats.cpu} | Mem: ${k8sStats.memory}`
                : 'k8s Stats: CPU: N/A | Mem: N/A'}
            </Text>
          </Box>
          {pods.length === 0 && !error?.type.includes('k8s') ? (
            <Text color="gray">  No pods found.</Text>
          ) : (
            pods.map(p => (
              <Box key={p.name} flexDirection="row" justifyContent="space-between" marginBottom={0}>
                <Text> {p.name.length > 25 ? p.name.substring(0, 22) + '...' : p.name}</Text>
                <StatusBadge status={p.status} type="pod" />
              </Box>
            ))
          )}
        </Box>

        <Box flexDirection="column" width="50%">
          <Box borderStyle="single" borderColor="blue" paddingX={1} marginBottom={1}>
            <Text color="blue" bold>Docker Containers ({containers.length})</Text>
          </Box>
          <Box marginBottom={1} paddingX={1}>
            <Text dimColor>
              {dockerStats 
                ? `Docker Stats: CPU: ${dockerStats.cpu.toFixed(1)}% | Mem: ${formatDockerBytes(dockerStats.memoryUsage)} / ${formatDockerBytes(dockerStats.memoryLimit)}`
                : 'Docker Stats: CPU: N/A | Mem: N/A'}
            </Text>
          </Box>
          {containers.length === 0 && !error?.type.includes('docker') ? (
            <Text color="gray">  No containers found.</Text>
          ) : (
            containers.map(c => (
              <Box key={c.id} flexDirection="row" justifyContent="space-between" marginBottom={0}>
                <Text> {c.name.length > 25 ? c.name.substring(0, 22) + '...' : c.name}</Text>
                <StatusBadge status={c.state} type="container" />
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
};
