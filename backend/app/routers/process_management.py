from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter()


# ============ ROLES ============

@router.get("/roles", response_model=List[schemas.ProcessRole])
def get_roles(db: Session = Depends(get_db)):
    """Получить все роли/должности"""
    return db.query(models.ProcessRole).filter(
        models.ProcessRole.is_active == True
    ).order_by(models.ProcessRole.order_index).all()


@router.post("/roles", response_model=schemas.ProcessRole)
def create_role(role: schemas.ProcessRoleCreate, db: Session = Depends(get_db)):
    """Создать новую роль"""
    db_role = models.ProcessRole(**role.dict())
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role


@router.put("/roles/{role_id}", response_model=schemas.ProcessRole)
def update_role(role_id: int, role: schemas.ProcessRoleUpdate, db: Session = Depends(get_db)):
    """Обновить роль"""
    db_role = db.query(models.ProcessRole).filter(models.ProcessRole.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    
    for key, value in role.dict(exclude_unset=True).items():
        setattr(db_role, key, value)
    
    db.commit()
    db.refresh(db_role)
    return db_role


@router.delete("/roles/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db)):
    """Удалить роль (мягкое удаление)"""
    db_role = db.query(models.ProcessRole).filter(models.ProcessRole.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    
    db_role.is_active = False
    db.commit()
    return {"message": "Роль удалена"}


@router.put("/roles/reorder")
def reorder_roles(role_ids: List[int], db: Session = Depends(get_db)):
    """Изменить порядок ролей"""
    for index, role_id in enumerate(role_ids):
        db_role = db.query(models.ProcessRole).filter(models.ProcessRole.id == role_id).first()
        if db_role:
            db_role.order_index = index
    db.commit()
    return {"message": "Порядок обновлён"}


# ============ STAGES ============

@router.get("/stages", response_model=List[schemas.ProcessStageWithAssignments])
def get_stages(db: Session = Depends(get_db)):
    """Получить все этапы с назначениями"""
    return db.query(models.ProcessStage).filter(
        models.ProcessStage.is_active == True
    ).order_by(models.ProcessStage.order_index).all()


@router.post("/stages", response_model=schemas.ProcessStageWithAssignments)
def create_stage(stage: schemas.ProcessStageCreate, db: Session = Depends(get_db)):
    """Создать новый этап"""
    # Определяем order_index
    max_order = db.query(models.ProcessStage).order_by(
        models.ProcessStage.order_index.desc()
    ).first()
    new_order = (max_order.order_index + 1) if max_order else 0
    
    db_stage = models.ProcessStage(**stage.dict(), order_index=new_order)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage


@router.put("/stages/{stage_id}", response_model=schemas.ProcessStageWithAssignments)
def update_stage(stage_id: int, stage: schemas.ProcessStageUpdate, db: Session = Depends(get_db)):
    """Обновить этап"""
    db_stage = db.query(models.ProcessStage).filter(models.ProcessStage.id == stage_id).first()
    if not db_stage:
        raise HTTPException(status_code=404, detail="Этап не найден")
    
    for key, value in stage.dict(exclude_unset=True).items():
        setattr(db_stage, key, value)
    
    db.commit()
    db.refresh(db_stage)
    return db_stage


@router.delete("/stages/{stage_id}")
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    """Удалить этап (мягкое удаление)"""
    db_stage = db.query(models.ProcessStage).filter(models.ProcessStage.id == stage_id).first()
    if not db_stage:
        raise HTTPException(status_code=404, detail="Этап не найден")
    
    db_stage.is_active = False
    db.commit()
    return {"message": "Этап удалён"}


@router.put("/stages/reorder")
def reorder_stages(stage_ids: List[int], db: Session = Depends(get_db)):
    """Изменить порядок этапов"""
    for index, stage_id in enumerate(stage_ids):
        db_stage = db.query(models.ProcessStage).filter(models.ProcessStage.id == stage_id).first()
        if db_stage:
            db_stage.order_index = index
    db.commit()
    return {"message": "Порядок обновлён"}


# ============ ASSIGNMENTS ============

@router.post("/assignments", response_model=schemas.ProcessAssignment)
def create_assignment(assignment: schemas.ProcessAssignmentCreate, db: Session = Depends(get_db)):
    """Создать назначение"""
    # Проверяем, существует ли уже такое назначение
    existing = db.query(models.ProcessAssignment).filter(
        models.ProcessAssignment.stage_id == assignment.stage_id,
        models.ProcessAssignment.role_id == assignment.role_id
    ).first()
    
    if existing:
        # Обновляем тип
        existing.assignment_type = assignment.assignment_type
        db.commit()
        db.refresh(existing)
        return existing
    
    db_assignment = models.ProcessAssignment(**assignment.dict())
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    return db_assignment


@router.delete("/assignments/{stage_id}/{role_id}")
def delete_assignment(stage_id: int, role_id: int, db: Session = Depends(get_db)):
    """Удалить назначение"""
    db_assignment = db.query(models.ProcessAssignment).filter(
        models.ProcessAssignment.stage_id == stage_id,
        models.ProcessAssignment.role_id == role_id
    ).first()
    
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    
    db.delete(db_assignment)
    db.commit()
    return {"message": "Назначение удалено"}


@router.put("/assignments/bulk")
def bulk_update_assignments(data: schemas.ProcessAssignmentBulkUpdate, db: Session = Depends(get_db)):
    """Массовое обновление назначений для этапа"""
    # Удаляем все текущие назначения для этапа
    db.query(models.ProcessAssignment).filter(
        models.ProcessAssignment.stage_id == data.stage_id
    ).delete()
    
    # Создаём новые назначения
    for assignment in data.assignments:
        db_assignment = models.ProcessAssignment(
            stage_id=data.stage_id,
            role_id=assignment['role_id'],
            assignment_type=assignment['assignment_type']
        )
        db.add(db_assignment)
    
    db.commit()
    return {"message": "Назначения обновлены"}


# ============ INIT DATA ============

@router.post("/init-default-data")
def init_default_data(db: Session = Depends(get_db)):
    """Инициализация данных по умолчанию"""
    
    # Проверяем, есть ли уже данные
    existing_roles = db.query(models.ProcessRole).first()
    if existing_roles:
        return {"message": "Данные уже инициализированы"}
    
    # Создаём роли
    default_roles = [
        {"name": "Совет учредителей", "short_name": "СУ", "order_index": 0},
        {"name": "Генеральный директор/исполнительный директор", "short_name": "ГД/ИД", "order_index": 1},
        {"name": "Директор по развитию", "short_name": "ДР", "order_index": 2},
        {"name": "Директор тех.заказа", "short_name": "ДТЗ", "order_index": 3},
        {"name": "Коммерческий директор", "short_name": "КД", "order_index": 4},
        {"name": "ЗГД по строительству", "short_name": "ЗГДС", "order_index": 5},
        {"name": "ГИП / РП", "short_name": "ГИП/РП", "order_index": 6},
        {"name": "Директор по продукту", "short_name": "ДП", "order_index": 7},
        {"name": "Руководитель отдела закупок", "short_name": "РОЗ", "order_index": 8},
        {"name": "Директор продажам", "short_name": "ДПр", "order_index": 9},
        {"name": "Директор отдела управления персоналом", "short_name": "ДОУП", "order_index": 10},
        {"name": "Финансовый директор", "short_name": "ФД", "order_index": 11},
    ]
    
    for role_data in default_roles:
        db_role = models.ProcessRole(**role_data)
        db.add(db_role)
    
    db.commit()
    
    # Создаём этапы
    default_stages = [
        {"number": "1", "name": "Подбор городов и земельных участков", "predecessor_number": None},
        {"number": "1.1", "name": "Сформирован перечень городов в соответствии с алгоритмом оценки и стратегией", "predecessor_number": None},
        {"number": "1.2", "name": "Сформирован перечень земельных участков в соответствии с алгоритмом оценки", "predecessor_number": "1.1"},
        {"number": "1.3", "name": "Проведены маркетинговые исследования по земельным участкам", "predecessor_number": "1.2"},
        {"number": "1.4", "name": "Подготовлена предварительная финансовая модель с учетом предварительной стоимости подключения (ТЭО)", "predecessor_number": "1.3"},
        {"number": "1.5", "name": "Проведены предварительные переговоры с банком по готовности проектного финансирования перспективных объектов", "predecessor_number": "1.4"},
        {"number": "1.6", "name": "Подготовлено решение о покупке земельного участка для утверждения советом учредителей", "predecessor_number": "1.5"},
        {"number": "1.7", "name": "Получены права на земельный участок", "predecessor_number": "1.6"},
        {"number": "1.8", "name": "Принято решение о запуске проекта", "predecessor_number": "1.7"},
        {"number": "2", "name": "Определение продукта - объекта строительства", "predecessor_number": None},
        {"number": "2.1", "name": "Разработана база данных по типовым решениям и объектам строительства - инженерия и технология. Альбомы типовых секций и лучших решений", "predecessor_number": "0"},
        {"number": "2.2", "name": "Разработана база данных по типовым решениям и объекта строительства - внешний вид, эргономика и функциональность. Альбомы схем и лучших решений", "predecessor_number": "0"},
        {"number": "2.3", "name": "Определены решения по благоустройству с учетом стоимости и обоснованности каждого решения", "predecessor_number": None},
        {"number": "2.4", "name": "Определен внешний вид здания с учетом стоимости и обоснованности каждого решения", "predecessor_number": None},
        {"number": "2.5", "name": "Определены оптимальные технологические решения строительства с учетом стоимости и обоснованности каждого решения", "predecessor_number": None},
        {"number": "2.6", "name": "Разработана концепция: позиционирование, основа бренда, нейминг", "predecessor_number": "1.8, 2.1-2.4."},
        {"number": "2.7", "name": "Заказана топосъемка на участок проекта", "predecessor_number": "1.8,2.3"},
        {"number": "2.8", "name": "Подготовлено задание для архитектора концептуалиста (при необходимости)", "predecessor_number": "2.7"},
        {"number": "2.9", "name": "Определен перечень маркетинговых атрибутов (при необходимости социальная и торгово-сервисная среда). Подготовлены решения по фасадам, благоустройству, детским площадкам и оборудованию, дизайну МОП, входных групп", "predecessor_number": "2.7"},
        {"number": "2.10", "name": "Подготовлено техническое задание на проектирование", "predecessor_number": "2.9"},
        {"number": "2.11", "name": "Проведен предварительный расчет нагрузок на инженерные сети по выбранному объекту строительства", "predecessor_number": "2.10"},
        {"number": "2.12", "name": "Подготовлен проект технических условий и точки подключения по результатам обращения в гос.органы", "predecessor_number": "2.10"},
        {"number": "2.13", "name": "Произведен предварительный расчет стоимости подключения", "predecessor_number": "2.11"},
        {"number": "2.14", "name": "Проведены переговоры с администрацией, получено одобрение проекта строительства", "predecessor_number": "2.12"},
        {"number": "2.15", "name": "Определены потенциальные поставщики материалов, работ и услуг в регионе строительства", "predecessor_number": "2.9"},
        {"number": "2.16", "name": "Определены потенциальные подрядчики для разработки концепции: дизайнеры интерьеров, ландшафтные дизайнеры", "predecessor_number": "1.8"},
        {"number": "3", "name": "Проектирование объекта строительства и получение РНС", "predecessor_number": None},
        {"number": "3.1", "name": "Получен перечень исходно-разрешительной документации (ГПЗУ, ТУ и т.д. в соответствии с ГРК и ИП по получению РНС)", "predecessor_number": "1.8"},
        {"number": "3.2", "name": "Проведено межевание участка с привлечением подрядной организации", "predecessor_number": "1.7"},
        {"number": "3.3", "name": "Проведены инженерные изыскания на основании технического задания", "predecessor_number": "2.9"},
        {"number": "3.4", "name": "На основании задания на проектирование проведен отбор проектной организации, архитектора, при необходимости, если новый проект (стадия П и Р)", "predecessor_number": "2.10"},
        {"number": "3.5", "name": "Подготовлен договор с проектировщиком, архитектором, с указанием стоимости и объема работ (стадия П и Р)", "predecessor_number": "3.4"},
        {"number": "3.6", "name": "Проведена проверка и согласование объемно-планировочных решений и архитектурной концепции", "predecessor_number": "3.5"},
        {"number": "3.7", "name": "Проведена проверка проектной документации на стадии \"П\"", "predecessor_number": "3.6"},
        {"number": "3.8", "name": "Проведена проверка благоустройства и вертикальной планировки", "predecessor_number": None},
        {"number": "3.9", "name": "Пройдена экспертиза проекта по стадии \"П\"", "predecessor_number": "3.7"},
        {"number": "3.10", "name": "Разработана стадия \"Р\"", "predecessor_number": None},
        {"number": "3.11", "name": "Подготовлен пакет документов для получения РНС", "predecessor_number": None},
        {"number": "3.12", "name": "Получено разрешение на строительство (РНС)", "predecessor_number": "3.9, 3.11"},
        {"number": "3.13", "name": "Проведен контроль актуальности финансовой модели для банка до начала строительства", "predecessor_number": "3.9"},
        {"number": "3.14", "name": "Подготовлен план продаж по типологиям, с учетом стартовой цены, ДЦО и темпов прироста", "predecessor_number": "3.13"},
        {"number": "3.15", "name": "Определение плановой штатной численности персонала на объекте строительства", "predecessor_number": "3.9"},
        {"number": "3.16", "name": "Определение штатной численности отдела продаж для открытия офиса продаж и запуска продаж", "predecessor_number": "3.13"},
        {"number": "3.17", "name": "Подготовлен паспорт проекта", "predecessor_number": "3.9"},
        {"number": "3.18", "name": "Подготовлена проектная декларация и получено заключение гос.органов", "predecessor_number": "3.12"},
        {"number": "3.19", "name": "Обеспечен процесс лидогенерации и сформирован спрос на продукт", "predecessor_number": "3.12"},
        {"number": "3.20", "name": "Подготовлен и выведен объект в продажу", "predecessor_number": "3.12,3.13"},
        {"number": "3.21", "name": "Обеспечена возможность получения денежных средств (Выполнение плана продаж в разрезе цен, выбывания и типологии, ДЦО)", "predecessor_number": "3.20"},
        {"number": "3.22", "name": "Проведена аккредитация для банков", "predecessor_number": "3.12"},
        {"number": "3.23", "name": "Запущен Офис продаж", "predecessor_number": None},
        {"number": "3.24", "name": "Передано в гос.строй надзор уведомление о начале работ. Получена программа проверок", "predecessor_number": "3.12, 3.36"},
        {"number": "3.25", "name": "Подготовлены ППР, ППРк на основании документации от проектировщиков. Актуализирован план перемещения кранов", "predecessor_number": "3.9"},
        {"number": "3.26", "name": "Проведена многостадийная проверка проектной документации на стадии \"Р\" (ПОС, смета). Проект утвержден ГИП и передан в работу генеральному подрядчику", "predecessor_number": "3.10"},
        {"number": "3.27", "name": "Составлены лимитно-заборные ведомости на основании проекта в стадии \"Р\"", "predecessor_number": "3.26"},
        {"number": "3.28", "name": "Подготовлены цены на услуги и ТМЦ (за квартал до старта строительства)", "predecessor_number": "2.1,2.2"},
        {"number": "3.29", "name": "На основании проектной документации и ЛЗВ подготовлена смета, финансовая модель, внесены данные в учетную систему Macro", "predecessor_number": "3.28"},
        {"number": "3.30", "name": "Детализирован календарный график строительства объекта", "predecessor_number": "3.27"},
        {"number": "3.31", "name": "Детализирован календарный график закупок основных ТМЦ, в т.ч. оборудования и оснастки", "predecessor_number": "3.30"},
        {"number": "3.32", "name": "Проведены тендеры и выбраны подрядные организации, ключевые поставщики ТМЦ. Заключены договоры. При необходимости подобраны аналоги", "predecessor_number": "3.31"},
        {"number": "3.33", "name": "Получено проектное финансирование", "predecessor_number": "3.14"},
        {"number": "3.34", "name": "Объект строительства укомплектован персоналом в соответствии со штатной структурой", "predecessor_number": "3.15"},
        {"number": "3.35", "name": "Объект строительства укомплектован необходимым строительным оборудованием", "predecessor_number": "3.25,3.32"},
        {"number": "3.36", "name": "Проведены подготовительные работы на объекте строительства. Обустроена строительная площадка", "predecessor_number": "3.12"},
        {"number": "4", "name": "Контроль проекта девелопментом до стадии объекта в эксплуатацию", "predecessor_number": None},
        {"number": "4.1", "name": "Проведены основные строительные работы на объекте", "predecessor_number": "3.24,3.36"},
        {"number": "4.2", "name": "Ведется учет изменений в проекте по технологии и стоимости", "predecessor_number": None},
        {"number": "4.3", "name": "Организован авторский контроль Девелопмента, определены контрольные точки проверки и формируются периодические отчеты.", "predecessor_number": "4.1"},
        {"number": "4.4", "name": "Проведены обмеры БТИ", "predecessor_number": "4.1"},
        {"number": "4.5", "name": "Подготовлены документы для получения ЗОС. Получен ЗОС.", "predecessor_number": "4.3"},
        {"number": "4.6", "name": "Проведена финальная внутренняя приёмка перед передачей квартир девелопменту", "predecessor_number": "4.1"},
        {"number": "4.7", "name": "Проведена финальная внутренняя приёмка перед передачей квартир участникам ДДУ (физическая приемка на объекте)", "predecessor_number": "4.6"},
        {"number": "4.8", "name": "Получено разрешение на ввод объекта в эксплуатацию (РНВ)", "predecessor_number": "4.4,4.5"},
        {"number": "4.9", "name": "Произведен расчет экономики объекта строительства. Подтверждена прибыль с квадратного метра", "predecessor_number": "4.8"},
        {"number": "4.10", "name": "Переданы квартиры УДС. Подготовлены акты, уведомления, выставлены счета на доплату. Произведены взаиморасчеты.", "predecessor_number": "4.8"},
        {"number": "4.11", "name": "Подготовлен пакет документов для передачи в УК. Переданы необходимые материалы.", "predecessor_number": "4.8"},
        {"number": "4.12", "name": "Подготовлен и подписан акт приема - передачи объекта строительства", "predecessor_number": "4.10"},
        {"number": "4.13", "name": "Проведена инвентаризация по результатам строительства (ТМЦ, спецодежда, механизмы, инструменты)", "predecessor_number": None},
        {"number": "4.14", "name": "Произведена перебазировка оборудования, технологической оснастки и инструментов на новые объекты или на базу", "predecessor_number": None},
    ]
    
    for idx, stage_data in enumerate(default_stages):
        stage_data["order_index"] = idx
        db_stage = models.ProcessStage(**stage_data)
        db.add(db_stage)
    
    db.commit()
    
    return {"message": "Данные инициализированы"}


@router.post("/reset-data")
def reset_data(db: Session = Depends(get_db)):
    """Сброс и реинициализация данных"""
    # Удаляем все назначения
    db.query(models.ProcessAssignment).delete()
    # Удаляем все этапы
    db.query(models.ProcessStage).delete()
    # Удаляем все роли
    db.query(models.ProcessRole).delete()
    db.commit()
    
    # Инициализируем заново
    return init_default_data(db)
