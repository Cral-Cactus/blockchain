import enum


class TransferTypeEnum(enum.Enum):
    PAYMENT     = "PAYMENT"
    DEPOSIT     = "DEPOSIT"
    WITHDRAWAL  = "WITHDRAWAL"
    EXCHANGE    = "EXCHANGE"
    FEE         = "FEE"


class TransferSubTypeEnum(enum.Enum):
    STANDARD        = 'STANDARD'
    DISBURSEMENT    = 'DISBURSEMENT'
    RECLAMATION     = 'RECLAMATION'
    AGENT_IN        = 'AGENT_IN'
    AGENT_OUT       = 'AGENT_OUT'
    FEE             = 'FEE'
    INCENTIVE       = 'INCENTIVE'


class TransferModeEnum(enum.Enum):
    NFC = "NFC"
    USSD = "USSD"
    SMS = "SMS"
    QR  = "QR"
    WEB = "WEB"
    MOBILE = "MOBILE"
    INTERNAL = "INTERNAL"
    EXTERNAL = "EXTERNAL"
    OTHER    = "OTHER"


class TransferStatusEnum(enum.Enum):
    PENDING = 'PENDING'
    REJECTED = 'REJECTED'
    COMPLETE = 'COMPLETE'
    PARTIAL = 'PARTIAL'

class BlockchainStatus(enum.Enum):
    PENDING = 'PENDING'
    SUCCESS = 'SUCCESS'
    FAILED = 'FAILED'
    UNSTARTED = 'UNSTARTED'