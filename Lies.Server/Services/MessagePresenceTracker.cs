using System.Collections.Concurrent;

namespace Lies.Server.Services;

public interface IMessagePresenceTracker
{
    void RegisterConnection(int userId, string connectionId);
    int? UnregisterConnection(string connectionId);
    bool IsUserOnline(int userId);
    IReadOnlyCollection<int> GetOnlineUserIds();
}

public class MessagePresenceTracker : IMessagePresenceTracker
{
    private readonly ConcurrentDictionary<string, int> _connectionUserMap = new();
    private readonly ConcurrentDictionary<int, ConcurrentDictionary<string, byte>> _userConnections = new();

    public void RegisterConnection(int userId, string connectionId)
    {
        _connectionUserMap[connectionId] = userId;
        var connections = _userConnections.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
        connections[connectionId] = 0;
    }

    public int? UnregisterConnection(string connectionId)
    {
        if (!_connectionUserMap.TryRemove(connectionId, out var userId))
        {
            return null;
        }

        if (_userConnections.TryGetValue(userId, out var connections))
        {
            connections.TryRemove(connectionId, out _);
            if (connections.IsEmpty)
            {
                _userConnections.TryRemove(userId, out _);
            }
        }

        return userId;
    }

    public bool IsUserOnline(int userId)
    {
        return _userConnections.TryGetValue(userId, out var connections) && !connections.IsEmpty;
    }

    public IReadOnlyCollection<int> GetOnlineUserIds()
    {
        return _userConnections
            .Where(item => !item.Value.IsEmpty)
            .Select(item => item.Key)
            .ToArray();
    }
}
